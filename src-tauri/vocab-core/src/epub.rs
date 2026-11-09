//! Reads an EPUB 2 or 3: its title, its spine documents in reading order with
//! their table-of-contents labels, and its cover image.

use std::collections::HashMap;
use std::fs::File;
use std::io::Read;
use std::path::Path;

use percent_encoding::percent_decode_str;
use roxmltree::{Document, Node, ParsingOptions};
use scraper::{Html, Selector};
use zip::ZipArchive;

use crate::error::{Error, Result};
use crate::extract::Cover;
use crate::text::decode;

pub struct Book {
    pub title: Option<String>,
    pub chapters: Vec<Chapter>,
    pub cover: Option<Cover>,
}

pub struct Chapter {
    /// The first table-of-contents label that points into this document.
    pub toc_title: Option<String>,
    pub html: String,
}

struct ManifestItem {
    /// The entry's path inside the zip archive.
    path: String,
    media_type: String,
    properties: String,
}

fn epub_error(error: impl std::fmt::Display) -> Error {
    Error::Epub(error.to_string())
}

pub fn read(path: &Path) -> Result<Book> {
    let mut archive = ZipArchive::new(File::open(path)?).map_err(epub_error)?;
    let container = read_entry(&mut archive, "META-INF/container.xml")?
        .ok_or_else(|| epub_error("META-INF/container.xml is missing"))?;
    let package_path = parse_xml(&container)?
        .descendants()
        .find(|node| node.tag_name().name() == "rootfile")
        .and_then(|rootfile| rootfile.attribute("full-path"))
        .map(str::to_owned)
        .ok_or_else(|| epub_error("the container names no package document"))?;
    let package_text = read_entry(&mut archive, &package_path)?
        .ok_or_else(|| epub_error(format!("{package_path} is missing")))?;
    let package = parse_xml(&package_text)?;
    let package_dir = parent_dir(&package_path);

    let manifest: HashMap<&str, ManifestItem> = elements(&package, "item")
        .filter_map(|item| {
            Some((
                item.attribute("id")?,
                ManifestItem {
                    path: resolve(package_dir, item.attribute("href")?),
                    media_type: item.attribute("media-type").unwrap_or_default().to_owned(),
                    properties: item.attribute("properties").unwrap_or_default().to_owned(),
                },
            ))
        })
        .collect();
    let spine: Vec<&ManifestItem> = elements(&package, "itemref")
        .filter_map(|itemref| manifest.get(itemref.attribute("idref")?))
        .collect();

    let mut toc = HashMap::new();
    if let Some(nav) = manifest.values().find(|item| has_property(item, "nav"))
        && let Some(text) = read_entry(&mut archive, &nav.path)?
    {
        nav_titles(&text, parent_dir(&nav.path), &mut toc);
    }
    let ncx_id = elements(&package, "spine").find_map(|spine| spine.attribute("toc"));
    if let Some(ncx) = ncx_id.and_then(|id| manifest.get(id))
        && let Some(text) = read_entry(&mut archive, &ncx.path)?
    {
        ncx_titles(&text, parent_dir(&ncx.path), &mut toc);
    }

    let mut chapters = Vec::new();
    for item in spine {
        if let Some(html) = read_entry(&mut archive, &item.path)? {
            chapters.push(Chapter {
                toc_title: toc.get(&item.path).cloned(),
                html,
            });
        }
    }

    let title = elements(&package, "title")
        .find_map(|title| title.text())
        .map(str::to_owned);
    let cover = match cover_item(&package, &manifest) {
        Some(item) => read_bytes(&mut archive, &item.path)?.map(|image| Cover {
            mime: item.media_type.clone(),
            image,
        }),
        None => None,
    };
    Ok(Book {
        title,
        chapters,
        cover,
    })
}

/// EPUB 3 marks the cover in the manifest; EPUB 2 names it in a `<meta>`.
fn cover_item<'a>(
    package: &Document,
    manifest: &'a HashMap<&str, ManifestItem>,
) -> Option<&'a ManifestItem> {
    manifest
        .values()
        .find(|item| has_property(item, "cover-image"))
        .or_else(|| {
            elements(package, "meta")
                .filter(|meta| meta.attribute("name") == Some("cover"))
                .find_map(|meta| manifest.get(meta.attribute("content")?))
        })
        .filter(|item| item.media_type.starts_with("image/"))
}

fn has_property(item: &ManifestItem, property: &str) -> bool {
    item.properties.split_whitespace().any(|p| p == property)
}

/// EPUB 3 table of contents: the links in the `<nav epub:type="toc">`.
fn nav_titles(text: &str, dir: &str, titles: &mut HashMap<String, String>) {
    let document = Html::parse_document(text);
    let navs = Selector::parse("nav").expect("valid selector");
    let links = Selector::parse("a[href]").expect("valid selector");
    let navs: Vec<_> = document.select(&navs).collect();
    let is_toc = |kind: &str| kind.split_whitespace().any(|kind| kind == "toc");
    let toc = navs
        .iter()
        .find(|nav| nav.attr("epub:type").is_some_and(is_toc))
        .or(navs.first());
    for link in toc.into_iter().flat_map(|nav| nav.select(&links)) {
        let label = link.text().collect::<String>();
        add_title(titles, dir, link.attr("href").unwrap_or_default(), &label);
    }
}

/// EPUB 2 table of contents: the NCX's `<navPoint>`s, parents before children.
fn ncx_titles(text: &str, dir: &str, titles: &mut HashMap<String, String>) {
    let Ok(ncx) = parse_xml(text) else {
        return;
    };
    for point in elements(&ncx, "navPoint") {
        let child = |name: &str| point.children().find(|node| node.tag_name().name() == name);
        let label = child("navLabel")
            .and_then(|label| {
                label
                    .descendants()
                    .find(|node| node.tag_name().name() == "text")
            })
            .and_then(|text| text.text());
        let src = child("content").and_then(|content| content.attribute("src"));
        if let (Some(label), Some(src)) = (label, src) {
            add_title(titles, dir, src, label);
        }
    }
}

fn add_title(titles: &mut HashMap<String, String>, dir: &str, href: &str, label: &str) {
    let label = label.split_whitespace().collect::<Vec<_>>().join(" ");
    if !label.is_empty() {
        titles.entry(resolve(dir, href)).or_insert(label);
    }
}

fn parse_xml(text: &str) -> Result<Document<'_>> {
    let options = ParsingOptions {
        allow_dtd: true,
        ..ParsingOptions::default()
    };
    Document::parse_with_options(text, options).map_err(epub_error)
}

/// Elements with this local name, whatever their namespace, in document order.
fn elements<'a, 'input>(
    document: &'a Document<'input>,
    name: &'a str,
) -> impl Iterator<Item = Node<'a, 'input>> + Clone {
    document
        .descendants()
        .filter(move |node| node.is_element() && node.tag_name().name() == name)
}

/// The text of an archive entry, or `None` when the book lacks it.
fn read_entry(archive: &mut ZipArchive<File>, path: &str) -> Result<Option<String>> {
    Ok(read_bytes(archive, path)?.map(|bytes| decode(&bytes)))
}

fn read_bytes(archive: &mut ZipArchive<File>, path: &str) -> Result<Option<Vec<u8>>> {
    let mut entry = match archive.by_name(path) {
        Ok(entry) => entry,
        Err(zip::result::ZipError::FileNotFound) => return Ok(None),
        Err(error) => return Err(epub_error(error)),
    };
    let mut bytes = Vec::new();
    entry.read_to_end(&mut bytes)?;
    Ok(Some(bytes))
}

/// The directory part of an archive path, with its trailing slash.
fn parent_dir(path: &str) -> &str {
    path.rfind('/').map_or("", |slash| &path[..=slash])
}

/// An href relative to `dir`, as an archive path: decoded, without its
/// fragment, and with `.` and `..` segments applied.
fn resolve(dir: &str, href: &str) -> String {
    let href = href.split('#').next().unwrap_or_default();
    let href = percent_decode_str(href).decode_utf8_lossy();
    let path = format!("{dir}{href}");
    let mut segments: Vec<&str> = Vec::new();
    for segment in path.split('/') {
        match segment {
            "" | "." => {}
            ".." => {
                segments.pop();
            }
            segment => segments.push(segment),
        }
    }
    segments.join("/")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_hrefs_against_their_document() {
        assert_eq!(resolve("OEBPS/", "c1.xhtml#start"), "OEBPS/c1.xhtml");
        assert_eq!(
            resolve("OEBPS/nav/", "../text/%E7%AC%AC1.xhtml"),
            "OEBPS/text/第1.xhtml"
        );
        assert_eq!(resolve("", "./c1.xhtml"), "c1.xhtml");
    }

    #[test]
    fn reads_an_epub_3_navigation_document() {
        let nav = r#"<html xmlns:epub="http://www.idpf.org/2007/ops"><body>
            <nav epub:type="landmarks"><a href="c0.xhtml">Cover</a></nav>
            <nav epub:type="toc"><ol>
              <li><a href="../text/c1.xhtml">第一章
                 开始</a><ol><li><a href="../text/c1.xhtml#s2">小节</a></li></ol></li>
              <li><a href="../text/c2.xhtml">第二章</a></li>
            </ol></nav></body></html>"#;
        let mut titles = HashMap::new();
        nav_titles(nav, "OEBPS/nav/", &mut titles);
        assert_eq!(
            titles,
            HashMap::from([
                ("OEBPS/text/c1.xhtml".into(), "第一章 开始".into()),
                ("OEBPS/text/c2.xhtml".into(), "第二章".into()),
            ])
        );
    }
}
