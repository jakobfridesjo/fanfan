use std::collections::HashMap;
use std::io::{Read, Seek};
use std::path::{Path, PathBuf};

use epub::doc::{EpubDoc, NavPoint};
use scraper::{ElementRef, Html, Node};

use crate::error::{Error, Result};
use crate::text::{contains_han, decode, is_han, normalize};

#[derive(Debug, Clone, PartialEq)]
pub struct Extracted {
    pub title: String,
    /// Chapters in reading order, each with Chinese text.
    pub sections: Vec<Section>,
    /// A plain text file has none.
    pub cover: Option<Cover>,
}

impl Extracted {
    /// The whole book, chapter after chapter.
    pub fn text(&self) -> String {
        self.sections
            .iter()
            .map(|section| section.text.as_str())
            .collect::<Vec<_>>()
            .join("\n")
    }
}

/// A chapter: one paragraph per line, without blank lines or indentation.
#[derive(Debug, Clone, PartialEq)]
pub struct Section {
    pub title: Option<String>,
    pub text: String,
}

/// An encoded cover image and its media type.
#[derive(Debug, Clone, PartialEq)]
pub struct Cover {
    pub mime: String,
    pub image: Vec<u8>,
}

impl Cover {
    /// The image inlined as a `data:` URL, ready for an `<img src>`.
    pub fn data_url(&self) -> String {
        use base64::Engine;
        let encoded = base64::engine::general_purpose::STANDARD.encode(&self.image);
        format!("data:{};base64,{encoded}", self.mime)
    }
}

/// The box a PDF's first page is drawn into for its cover, in pixels.
const PDF_COVER_SIZE: (u32, u32) = (400, 600);
/// Pages per section of a PDF without bookmarks.
const PDF_PAGES_PER_SECTION: usize = 10;
/// The length a text file without chapter headings is cut into, in characters.
const TEXT_SECTION_CHARS: usize = 5000;
/// A longer line is prose, not a chapter heading.
const HEADING_MAX_CHARS: usize = 30;

/// Elements that end a line of text, so paragraphs do not run together.
const BLOCK_ELEMENTS: &[&str] = &[
    "p",
    "div",
    "br",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "tr",
    "blockquote",
    "section",
];
/// Elements whose text is not part of the reading: ruby annotations (pinyin) included.
const SKIPPED_ELEMENTS: &[&str] = &["head", "title", "script", "style", "rt", "rp"];
/// Headings that can name an EPUB chapter the table of contents leaves out.
const HEADING_ELEMENTS: &[&str] = &["h1", "h2", "h3"];

enum Format {
    Text,
    Epub,
    Pdf,
}

/// An EPUB starts with an uncompressed `mimetype` entry: a local zip header,
/// whose name begins at byte 30, then the media type as its content.
const EPUB_SIGNATURE: &[u8] = b"mimetypeapplication/epub+zip";

/// Recognizes a PDF or EPUB by its first bytes, for files whose name says
/// nothing: an Android content URI has no extension.
fn sniff_format(path: &Path) -> Result<Option<Format>> {
    let mut head = Vec::new();
    std::fs::File::open(path)?
        .take((30 + EPUB_SIGNATURE.len()) as u64)
        .read_to_end(&mut head)?;
    Ok(if head.starts_with(b"%PDF-") {
        Some(Format::Pdf)
    } else if head.starts_with(b"PK\x03\x04") && head.get(30..) == Some(EPUB_SIGNATURE) {
        Some(Format::Epub)
    } else {
        None
    })
}

fn format_of_extension(extension: &str) -> Option<Format> {
    match extension {
        "" | "txt" | "text" | "md" => Some(Format::Text),
        "epub" => Some(Format::Epub),
        "pdf" => Some(Format::Pdf),
        _ => None,
    }
}

pub fn extract(path: &Path) -> Result<Extracted> {
    let extension = path
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or_default()
        .to_lowercase();
    let file_title = path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or("Untitled")
        .to_owned();

    let format = sniff_format(path)?
        .or_else(|| format_of_extension(&extension))
        .ok_or(Error::UnsupportedFile(extension))?;
    let (title, sections, cover) = match format {
        Format::Text => (None, text_sections(&decode(&std::fs::read(path)?)), None),
        Format::Epub => extract_epub(path)?,
        Format::Pdf => extract_pdf(path)?,
    };

    Ok(Extracted {
        title: title
            .filter(|title| !title.trim().is_empty())
            .unwrap_or(file_title),
        sections: sections
            .into_iter()
            .map(|section| Section {
                title: section
                    .title
                    .map(|title| normalize(title.trim()))
                    .filter(|title| !title.is_empty()),
                text: paragraphs(&normalize(&section.text)),
            })
            .filter(|section| contains_han(&section.text))
            .collect(),
        cover,
    })
}

/// Trimmed non-empty lines; trimming also drops the ideographic-space indent.
fn paragraphs(text: &str) -> String {
    text.lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

fn extract_epub(path: &Path) -> Result<(Option<String>, Vec<Section>, Option<Cover>)> {
    let mut book = EpubDoc::new(path).map_err(|error| Error::Epub(error.to_string()))?;
    let titles = toc_titles(&book);
    let mut sections = Vec::new();
    for chapter in 0..book.get_num_chapters() {
        book.set_current_chapter(chapter);
        if let Some((html, _mime)) = book.get_current_str() {
            let document = Html::parse_document(&html);
            sections.push(Section {
                title: titles
                    .get(&chapter)
                    .cloned()
                    .or_else(|| first_heading(&document)),
                text: readable_text(document.root_element()),
            });
        }
    }
    let cover = book.get_cover().map(|(image, mime)| Cover { mime, image });
    Ok((book.get_title(), sections, cover))
}

/// Spine chapter to the first table-of-contents label pointing into it. The
/// epub crate reads only an EPUB 2 NCX table, so EPUB 3-only books have none.
fn toc_titles<R: Read + Seek>(book: &EpubDoc<R>) -> HashMap<usize, String> {
    fn visit<R: Read + Seek>(
        book: &EpubDoc<R>,
        points: &[NavPoint],
        titles: &mut HashMap<usize, String>,
    ) {
        for point in points {
            let file = point.content.to_string_lossy();
            let file = PathBuf::from(file.split('#').next().unwrap_or_default());
            if let Some(chapter) = book.resource_uri_to_chapter(&file) {
                titles.entry(chapter).or_insert_with(|| point.label.clone());
            }
            visit(book, &point.children, titles);
        }
    }
    let mut titles = HashMap::new();
    visit(book, &book.toc, &mut titles);
    titles
}

fn first_heading(document: &Html) -> Option<String> {
    document
        .root_element()
        .descendants()
        .filter_map(ElementRef::wrap)
        .find(|element| HEADING_ELEMENTS.contains(&element.value().name()))
        .map(|heading| {
            readable_text(heading)
                .split_whitespace()
                .collect::<Vec<_>>()
                .join(" ")
        })
        .filter(|heading| !heading.is_empty())
}

fn readable_text(element: ElementRef<'_>) -> String {
    let mut text = String::new();
    for node in element.descendants() {
        match node.value() {
            Node::Text(content) => {
                let skipped = node.ancestors().any(|ancestor| {
                    ancestor
                        .value()
                        .as_element()
                        .is_some_and(|element| SKIPPED_ELEMENTS.contains(&element.name()))
                });
                if !skipped {
                    text.push_str(content);
                }
            }
            Node::Element(element) if BLOCK_ELEMENTS.contains(&element.name()) => text.push('\n'),
            _ => {}
        }
    }
    text
}

fn extract_pdf(path: &Path) -> Result<(Option<String>, Vec<Section>, Option<Cover>)> {
    let pdf_error = |error: pdf_oxide::Error| Error::Pdf(error.to_string());
    let document = pdf_oxide::PdfDocument::open(path).map_err(pdf_error)?;
    let pages = (0..document.page_count().map_err(pdf_error)?)
        .map(|page| document.extract_text(page).map_err(pdf_error))
        .collect::<Result<Vec<_>>>()?;
    Ok((
        None,
        pdf_sections(pages, &pdf_bookmarks(&document))
            .into_iter()
            .map(|section| Section {
                text: reflow(&section.text),
                ..section
            })
            .collect(),
        pdf_cover(&document),
    ))
}

/// Top-level bookmarks that point at a page, as (page index, title).
/// Unreadable bookmarks leave the PDF cut into fixed runs of pages instead.
fn pdf_bookmarks(document: &pdf_oxide::PdfDocument) -> Vec<(usize, String)> {
    let outline = document.get_outline().ok().flatten().unwrap_or_default();
    outline
        .into_iter()
        .filter_map(|item| match item.dest {
            Some(pdf_oxide::Destination::PageIndex(page)) => Some((page, item.title)),
            _ => None,
        })
        .collect()
}

/// A section from each bookmarked page to the next (pages before the first
/// bookmark form an untitled one), or runs of pages when there are none.
fn pdf_sections(pages: Vec<String>, bookmarks: &[(usize, String)]) -> Vec<Section> {
    let mut starts: Vec<(usize, Option<String>)> = bookmarks
        .iter()
        .filter(|(page, _)| *page < pages.len())
        .map(|(page, title)| (*page, Some(title.clone())))
        .collect();
    starts.sort_by_key(|(page, _)| *page);
    starts.dedup_by_key(|(page, _)| *page);
    if starts.is_empty() {
        starts = (0..pages.len())
            .step_by(PDF_PAGES_PER_SECTION)
            .map(|page| (page, None))
            .collect();
    } else if starts[0].0 > 0 {
        starts.insert(0, (0, None));
    }
    let ends = starts
        .iter()
        .skip(1)
        .map(|(page, _)| *page)
        .chain([pages.len()]);
    starts
        .iter()
        .zip(ends)
        .map(|((start, title), end)| Section {
            title: title.clone(),
            text: pages[*start..end].join("\n"),
        })
        .collect()
}

/// Joins a PDF's printed lines back into paragraphs; otherwise each line
/// would become one, cutting words such as 孩子 in two at the line end.
/// A line ends its paragraph when it is a heading or has no Chinese (a page
/// number), when the next line is indented or blank, or when it ends a
/// sentence short of the full line width.
fn reflow(text: &str) -> String {
    let lines: Vec<&str> = text.lines().collect();
    let full_width = full_line_width(&lines);
    let ends_paragraph = |line: &str, next: &str| {
        let trimmed = line.trim();
        trimmed.is_empty()
            || next.trim().is_empty()
            || next.starts_with([' ', '\u{3000}', '\t'])
            || [line, next]
                .iter()
                .any(|line| is_chapter_heading(line) || !contains_han(line))
            || (trimmed.ends_with(|c| PARAGRAPH_ENDS.contains(c))
                && trimmed.chars().count() < full_width)
    };

    let lines: Vec<String> = lines
        .iter()
        .map(|line| {
            if is_chapter_heading(line) {
                (*line).to_owned()
            } else {
                close_spaced_han(line)
            }
        })
        .collect();
    let mut text = String::new();
    for (index, line) in lines.iter().enumerate() {
        let Some(next) = lines.get(index + 1) else {
            text.push_str(line);
            break;
        };
        if ends_paragraph(line, next) {
            text.push_str(line);
            text.push('\n');
            continue;
        }
        let line = line.trim_end();
        text.push_str(line);
        let latin = |c: Option<char>| c.is_some_and(|c| c.is_ascii_alphanumeric());
        if latin(line.chars().last()) && latin(next.trim_start().chars().next()) {
            text.push(' ');
        }
    }
    text
}

/// PDF text extraction can put a space between two glyphs of a word (告 诉);
/// Chinese never spaces Han characters apart, so such spaces are dropped.
fn close_spaced_han(line: &str) -> String {
    let chars: Vec<char> = line.chars().collect();
    let mut closed = String::with_capacity(line.len());
    for (index, &c) in chars.iter().enumerate() {
        if c == ' ' {
            let before = chars[..index].iter().rev().find(|&&c| c != ' ');
            let after = chars[index + 1..].iter().find(|&&c| c != ' ');
            if before.is_some_and(|&c| is_han(c)) && after.is_some_and(|&c| is_han(c)) {
                continue;
            }
        }
        closed.push(c);
    }
    closed
}

/// Sentence ends, with the closing quotes and brackets that can follow them.
const PARAGRAPH_ENDS: &str = "。！？!?…”’」』）)\"";

/// How many characters a full printed line holds: most lines of running
/// text are full, so a line one character short of the longest common
/// length still counts.
fn full_line_width(lines: &[&str]) -> usize {
    let mut widths: Vec<usize> = lines
        .iter()
        .filter(|line| contains_han(line))
        .map(|line| line.trim().chars().count())
        .collect();
    widths.sort_unstable();
    let common = widths.get(widths.len() * 9 / 10).copied().unwrap_or(0);
    common.saturating_sub(1)
}

/// The first page as a JPEG. A page the renderer cannot draw leaves the book
/// without a cover rather than failing the import.
fn pdf_cover(document: &pdf_oxide::PdfDocument) -> Option<Cover> {
    use pdf_oxide::rendering::{RenderOptions, render_page_fit};
    let options = RenderOptions::default().as_jpeg(85);
    let (width, height) = PDF_COVER_SIZE;
    render_page_fit(document, 0, width, height, &options)
        .map(|image| Cover {
            mime: "image/jpeg".into(),
            image: image.data,
        })
        .ok()
}

/// Chapters start at headings like 第一章 or 第12回; text without any is cut
/// into pieces of about [`TEXT_SECTION_CHARS`] at line breaks.
fn text_sections(text: &str) -> Vec<Section> {
    if !text.lines().any(is_chapter_heading) {
        return cut_by_length(text);
    }
    let mut sections = vec![Section {
        title: None,
        text: String::new(),
    }];
    for line in text.lines() {
        if is_chapter_heading(line) {
            sections.push(Section {
                title: Some(line.trim().to_owned()),
                text: String::new(),
            });
        }
        let current = sections
            .last_mut()
            .expect("starts with an untitled section");
        current.text.push_str(line);
        current.text.push('\n');
    }
    sections
}

fn cut_by_length(text: &str) -> Vec<Section> {
    let mut sections = Vec::new();
    let mut current = String::new();
    for line in text.lines() {
        if current.chars().count() >= TEXT_SECTION_CHARS {
            sections.push(Section {
                title: None,
                text: std::mem::take(&mut current),
            });
        }
        current.push_str(line);
        current.push('\n');
    }
    sections.push(Section {
        title: None,
        text: current,
    });
    sections
}

fn is_chapter_heading(line: &str) -> bool {
    let line = line.trim();
    let Some(rest) = line.strip_prefix('第') else {
        return false;
    };
    let numeral = rest
        .chars()
        .take_while(|c| {
            c.is_ascii_digit() || "０１２３４５６７８９零〇一二三四五六七八九十百千两".contains(*c)
        })
        .count();
    numeral > 0
        && rest
            .chars()
            .nth(numeral)
            .is_some_and(|c| "章回节節卷".contains(c))
        && line.chars().count() <= HEADING_MAX_CHARS
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    /// A file in its own temporary directory, removed when dropped.
    struct TempFile {
        _directory: tempfile::TempDir,
        path: std::path::PathBuf,
    }

    impl std::ops::Deref for TempFile {
        type Target = Path;

        fn deref(&self) -> &Path {
            &self.path
        }
    }

    fn temp_file(name: &str, bytes: &[u8]) -> TempFile {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join(name);
        std::fs::write(&path, bytes).unwrap();
        TempFile {
            _directory: directory,
            path,
        }
    }

    /// Not a real image: the cover is passed on as the file's bytes.
    const COVER: &[u8] = b"\x89PNG cover";

    fn epub_bytes() -> Vec<u8> {
        let mut bytes = Vec::new();
        {
            let mut zip = zip::ZipWriter::new(std::io::Cursor::new(&mut bytes));
            let stored = zip::write::SimpleFileOptions::default()
                .compression_method(zip::CompressionMethod::Stored);
            let files = [
                ("mimetype", "application/epub+zip"),
                (
                    "META-INF/container.xml",
                    r#"<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>"#,
                ),
                (
                    "OEBPS/content.opf",
                    r#"<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>春天的故事</dc:title><dc:identifier id="id">test</dc:identifier></metadata><manifest><item id="cover" href="cover.png" media-type="image/png" properties="cover-image"/><item id="c0" href="c0.xhtml" media-type="application/xhtml+xml"/><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="c2.xhtml" media-type="application/xhtml+xml"/><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/></manifest><spine toc="ncx"><itemref idref="c0"/><itemref idref="c1"/><itemref idref="c2"/></spine></package>"#,
                ),
                (
                    "OEBPS/toc.ncx",
                    r#"<?xml version="1.0"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><navMap><navPoint id="n2" playOrder="1"><navLabel><text>第二章 春天</text></navLabel><content src="c2.xhtml#start"/></navPoint></navMap></ncx>"#,
                ),
                (
                    "OEBPS/c0.xhtml",
                    r#"<html xmlns="http://www.w3.org/1999/xhtml"><body><p>Copyright 2026</p></body></html>"#,
                ),
                (
                    "OEBPS/c1.xhtml",
                    r#"<html xmlns="http://www.w3.org/1999/xhtml"><head><title>目录标题</title><style>p{}</style></head><body><h1>第一章</h1><p>我们学习<ruby>中文<rt>zhōngwén</rt></ruby>。</p><p>北京很好</p></body></html>"#,
                ),
                (
                    "OEBPS/c2.xhtml",
                    r#"<html xmlns="http://www.w3.org/1999/xhtml"><body><p id="start">　　第二章</p><p>春天来了。</p></body></html>"#,
                ),
            ];
            for (name, content) in files {
                zip.start_file(name, stored).unwrap();
                zip.write_all(content.as_bytes()).unwrap();
            }
            zip.start_file("OEBPS/cover.png", stored).unwrap();
            zip.write_all(COVER).unwrap();
            zip.finish().unwrap();
        }
        bytes
    }

    #[test]
    fn reads_epub_chapters_in_spine_order_without_annotations() {
        let path = temp_file("book.epub", &epub_bytes());
        let extracted = extract(&path).unwrap();
        assert_eq!(extracted.title, "春天的故事");
        assert_eq!(
            extracted.sections,
            [
                Section {
                    title: Some("第一章".into()),
                    text: "第一章\n我们学习中文。\n北京很好".into(),
                },
                Section {
                    title: Some("第二章 春天".into()),
                    text: "第二章\n春天来了。".into(),
                },
            ]
        );
        let cover = extracted.cover.unwrap();
        assert_eq!(
            (cover.mime.as_str(), cover.image.as_slice()),
            ("image/png", COVER)
        );
    }

    #[test]
    fn reads_chinese_pdf_text() {
        let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/chinese.pdf");
        let extracted = extract(&path).unwrap();
        assert_eq!(extracted.title, "chinese");
        let text = extracted.text();
        assert!(text.contains("我们在北京大学学习中文"));
        assert!(text.contains("第一章"));
        let cover = extracted.cover.unwrap();
        assert_eq!(cover.mime, "image/jpeg");
        assert_eq!(cover.image[..2], [0xFF, 0xD8]);
    }

    #[test]
    fn inlines_a_cover_as_a_data_url() {
        let cover = Cover {
            mime: "image/png".into(),
            image: b"png".to_vec(),
        };
        assert_eq!(cover.data_url(), "data:image/png;base64,cG5n");
    }

    #[test]
    fn reads_legacy_encoded_text_files() {
        let (gbk, _, _) = encoding_rs::GBK.encode("我们在北京学习中文，觉得汉语很有意思。");
        let extracted = extract(&temp_file("故事.TXT", &gbk)).unwrap();
        assert_eq!(extracted.title, "故事");
        assert_eq!(
            extracted.sections,
            [Section {
                title: None,
                text: "我们在北京学习中文，觉得汉语很有意思。".into(),
            }]
        );
        assert_eq!(extracted.cover, None);
    }

    #[test]
    fn splits_text_files_at_chapter_headings() {
        let text = "序\n　　前言很短。\n第一章 开始\n我们学习。\n\n第12回\n他们学习。\n第二章的内容很长，不是标题，因为这一行有三十多个字，一定是正文里的一句话。";
        let extracted = extract(&temp_file("小说.txt", text.as_bytes())).unwrap();
        let titles: Vec<Option<&str>> = extracted
            .sections
            .iter()
            .map(|section| section.title.as_deref())
            .collect();
        assert_eq!(titles, [None, Some("第一章 开始"), Some("第12回")]);
        assert_eq!(extracted.sections[0].text, "序\n前言很短。");
        assert!(extracted.sections[2].text.ends_with("一句话。"));
    }

    #[test]
    fn cuts_text_without_headings_by_length() {
        let line = format!("{}。\n", "中".repeat(999));
        let extracted = extract(&temp_file("长.txt", line.repeat(12).as_bytes())).unwrap();
        let lengths: Vec<usize> = extracted
            .sections
            .iter()
            .map(|section| section.text.lines().count())
            .collect();
        assert_eq!(lengths, [5, 5, 2]);
    }

    #[test]
    fn splits_pdfs_at_bookmarks_or_into_runs_of_pages() {
        let pages: Vec<String> = (0..25).map(|page| format!("第{page}页")).collect();
        let bookmarked = pdf_sections(
            pages.clone(),
            &[
                (5, "上".into()),
                (2, "序".into()),
                (5, "重复".into()),
                (99, "外".into()),
            ],
        );
        let spans: Vec<(Option<&str>, usize)> = bookmarked
            .iter()
            .map(|section| (section.title.as_deref(), section.text.lines().count()))
            .collect();
        assert_eq!(spans, [(None, 2), (Some("序"), 3), (Some("上"), 20)]);

        let runs = pdf_sections(pages, &[]);
        let lengths: Vec<usize> = runs
            .iter()
            .map(|section| section.text.lines().count())
            .collect();
        assert_eq!(lengths, [10, 10, 5]);
        assert!(runs.iter().all(|section| section.title.is_none()));
    }

    #[test]
    fn joins_pdf_lines_back_into_paragraphs() {
        let page = [
            "第一章 开始",
            "与三体文明的战争使人类第一次看到了",
            "宇宙暗黑的真相，地球文明像一个恐惧的孩",
            "子，熄灭了寻友的篝火。",
            "　　自以为历尽沧桑，其实刚刚蹒跚学步，",
            "还远没有竞争的资格。他说的是 PDF",
            "file 吗？请你也告 诉我。",
            "12",
            "真正的星际战争没人见过，也不可能见到，因",
            "为战争的方式和武器已经远远超出人类的想",
            "象，目睹战场之时，就是灭亡之时。",
        ]
        .join("\n");
        assert_eq!(
            reflow(&page),
            [
                "第一章 开始",
                "与三体文明的战争使人类第一次看到了宇宙暗黑的真相，地球文明像一个恐惧的孩子，熄灭了寻友的篝火。",
                "　　自以为历尽沧桑，其实刚刚蹒跚学步，还远没有竞争的资格。他说的是 PDF file 吗？请你也告诉我。",
                "12",
                "真正的星际战争没人见过，也不可能见到，因为战争的方式和武器已经远远超出人类的想象，目睹战场之时，就是灭亡之时。",
            ]
            .join("\n")
        );
    }

    #[test]
    fn recognizes_a_file_without_an_extension_by_its_content() {
        let epub = extract(&temp_file("1000", &epub_bytes())).unwrap();
        assert_eq!(epub.title, "春天的故事");

        let text = extract(&temp_file("1001", "我们学习中文".as_bytes())).unwrap();
        assert_eq!(text.title, "1001");
        assert_eq!(text.sections.len(), 1);
    }

    #[test]
    fn rejects_unknown_file_types() {
        let error = extract(&temp_file("notes.docx", b"")).unwrap_err();
        assert!(matches!(error, Error::UnsupportedFile(extension) if extension == "docx"));
    }
}
