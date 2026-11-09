import { SceneCanvas } from "@/app/layouts/SceneCanvas.tsx";
import type { Scene } from "@/app/layouts/webgl-scene.ts";

const PYREFLY_COUNT = 15;
/** Each trail is this many quads along the path the pyrefly just took, so it bends as it does. */
const TRAIL_SEGMENTS = 160;
const TRAIL_STEP_SECONDS = 0.035;

const TRAIL = 0;
const ORB = 1;
const CLOUDS = 2;

function between(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function mix(far: number, near: number, nearness: number) {
  return far + (near - far) * nearness;
}

/**
 * The 11 floats every part of one pyrefly shares; the shader reads them as a0..a2.z. Nearer ones
 * are larger, brighter and cross the screen faster in wider curves, so the swarm has depth.
 */
function pyreflyPath(nearness: number) {
  const riseSeconds = mix(70, 24, nearness) * between(0.85, 1.15);
  const pulseSeconds = between(2, 5);
  return [
    between(0.05, 0.95),
    riseSeconds,
    between(0, riseSeconds),
    mix(2.5, 12, nearness * nearness),
    mix(26, 13, nearness) * between(0.8, 1.2),
    mix(3, 16, nearness) * between(0.7, 1.3),
    Math.random(),
    pulseSeconds,
    between(0, pulseSeconds),
    nearness,
    0,
  ];
}

function pyrefly(nearness: number) {
  const shared = pyreflyPath(nearness);
  return [
    ...Array.from({ length: TRAIL_SEGMENTS }, (_, segment) => [...shared, TRAIL, segment, 0, 0, 0]),
    [...shared, ORB, 0, 0, 0, 0],
  ].flat();
}

/** Spread evenly from far to near, drawn far first so nearer ones pass in front. */
const NEARNESS = Array.from(
  { length: PYREFLY_COUNT },
  (_, index) => (index + Math.random()) / PYREFLY_COUNT
);

const CLOUD_LAYER = [...Array.from({ length: 11 }, () => 0), CLOUDS, 0, 0, 0, 0];

/** The clouds over the whole canvas first, then each pyrefly's trail and orb, the farthest first. */
const PYREFLIES: Scene = {
  floatsPerParticle: 16,
  particles: Float32Array.from([...CLOUD_LAYER, ...NEARNESS.flatMap(pyrefly)]),
  colors: ["--pyrefly-core", "--pyrefly-glow", "--pyreflies-cloud"],
  reducedMotion: "still",
  vertex: `
out vec2 pixel;
out vec2 local;
flat out vec2 screen;
flat out float kind;
flat out float seconds;
flat out float size;
flat out float seed;
flat out float opacity;
flat out float flare;
flat out float tilt;

const float TRAIL_SEGMENTS = ${TRAIL_SEGMENTS}.0;
const float TRAIL_STEP = ${TRAIL_STEP_SECONDS.toFixed(3)};

/** How many times it has crossed the screen; the fraction is how far up it is now. */
float climbs(float at) {
  return (at + a0.z) / a0.y;
}

/** Rising from below the bottom edge to above the top in long, uneven S-curves. */
vec2 lightAt(float at) {
  float turn = 2.0 * PI * (at / a1.x + a1.z);
  float sway = (sin(turn) + 0.4 * sin(turn * 2.3 + a1.z * 9.0)) * a1.y * vmin();
  return vec2(a0.x * resolution.x + sway, mix(1.15, -0.15, fract(climbs(at))) * resolution.y);
}

/**
 * Where an edge of the trail lies, across pixels to the side of the path. On the inside of a
 * sharp turn the edge stops at the turn's centre, or the trail would fold over itself; across is
 * narrowed to match, so the smoke there is cut off rather than squeezed.
 */
vec2 trailEdgeAt(float at, inout float across) {
  vec2 behind = lightAt(at + TRAIL_STEP);
  vec2 here = lightAt(at);
  vec2 ahead = lightAt(at - TRAIL_STEP);
  vec2 tangent = ahead - behind;
  float speed = length(tangent);
  vec2 heading = speed > 0.001 ? tangent / speed : vec2(0.0, 1.0);
  vec2 side = vec2(-heading.y, heading.x);
  vec2 bend = ahead - 2.0 * here + behind;
  float inward = dot(bend, side);
  if (inward * across > 0.0) {
    float radius = 0.25 * speed * speed / abs(inward);
    across = sign(across) * min(abs(across), radius);
  }
  return here + side * across;
}

void main() {
  kind = a2.w;
  seconds = time;
  if (kind > 1.5) {
    pixel = vec2(corner.x * 0.5 + 0.5, 0.5 - corner.y * 0.5) * resolution;
    screen = resolution;
    gl_Position = vec4(corner, 0.0, 1.0);
    return;
  }

  size = a0.w;
  seed = a1.z;
  float progress = fract(climbs(time));
  opacity = mix(0.55, 1.0, a2.y) * mix(0.75, 1.0, swing(a1.w, a2.x))
    * smoothstep(0.0, 0.1, progress) * smoothstep(1.0, 0.85, progress);
  // Now and then an orb catches the lens: its flare swells and fades on a cycle of its own, and
  // the starburst turns a little. About a third of the orbs never flare.
  float catching = max(sin(2.0 * PI * (time / (0.8 * a1.x) + a1.z * 7.0)), 0.0);
  flare = step(0.35, fract(a1.z * 13.7)) * catching * catching * catching;
  tilt = 0.2 * sin(time * 0.15 + a1.z * 6.0);

  if (kind < 0.5) {
    float segment = a3.x;
    float startAt = time - segment * TRAIL_STEP;
    // The part of the trail left at the top before it started over at the bottom.
    if (floor(climbs(startAt - TRAIL_STEP)) != floor(climbs(time))) {
      gl_Position = vec4(-2.0, -2.0, 0.0, 1.0);
      return;
    }
    // Each end is mitred along its neighbouring points, so neighbouring segments share an edge.
    float end = corner.x * 0.5 + 0.5;
    float at = startAt - end * TRAIL_STEP;
    float across = corner.y * 2.6 * size;
    gl_Position = clip(trailEdgeAt(at, across));
    local = vec2((segment + end) / TRAIL_SEGMENTS, across);
    return;
  }

  local = corner * 16.0 * size;
  gl_Position = clip(lightAt(time) + local);
}
`,
  fragment: `
in vec2 pixel;
in vec2 local;
flat in vec2 screen;
flat in float kind;
flat in float seconds;
flat in float size;
flat in float seed;
flat in float opacity;
flat in float flare;
flat in float tilt;

const float PI = 3.14159265;
const float TRAIL_SECONDS = ${(TRAIL_SEGMENTS * TRAIL_STEP_SECONDS).toFixed(3)};

vec3 rainbow(float hue) {
  return 0.5 + 0.5 * cos(2.0 * PI * (hue + vec3(0.0, 0.33, 0.67)));
}

float hash(vec2 point) {
  return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 point) {
  vec2 cell = floor(point);
  vec2 along = smoothstep(0.0, 1.0, fract(point));
  return mix(
    mix(hash(cell), hash(cell + vec2(1.0, 0.0)), along.x),
    mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0, 1.0)), along.x),
    along.y
  );
}

float fbm(vec2 point) {
  float sum = 0.0;
  float amplitude = 0.5;
  for (int octave = 0; octave < 4; octave++) {
    sum += amplitude * noise(point);
    point = point * 2.03 + vec2(17.0, 9.0);
    amplitude *= 0.5;
  }
  return sum;
}

/**
 * The smoky wake: as wide as the orb's glow, mottled with the shifting colours of oil on water.
 * The pattern is tied to when each part was left behind, so it stays put as the orb moves on.
 */
vec4 trail() {
  float fraction = local.x;
  float leftAt = seconds - fraction * TRAIL_SECONDS;
  float width = size * mix(1.6, 2.4, sqrt(fraction));
  float across = local.y / width;
  vec2 smoke = vec2(leftAt * 1.2 + seed * 40.0, across * 1.2 + seconds * 0.15);
  float swirl = fbm(smoke + fbm(smoke * 0.7) * 1.5);
  vec3 color = mix(rainbow(seed + swirl * 2.2 + across * 0.3), vec3(1.0), 0.2);
  float mottle = smoothstep(0.25, 0.75, fbm(smoke * 1.7 + 3.0));
  float edge = smoothstep(1.0, 0.15, abs(across + (swirl - 0.5) * 0.6));
  float fade = smoothstep(0.0, 0.06, fraction) * pow(1.0 - fraction, 1.4);
  float alpha = colors[1].a * edge * fade * mix(0.3, 1.0, mottle) * opacity;
  return vec4(color * alpha, alpha);
}

/** One thin streak of a starburst through the centre, fading towards both ends. */
float ray(vec2 point, float angle, float reach) {
  vec2 direction = vec2(cos(angle), sin(angle));
  float along = abs(dot(point, direction));
  float across = abs(dot(point, vec2(-direction.y, direction.x)));
  float width = 0.08 * size + 0.02 * along;
  return exp(-across * across / (width * width)) * exp(-along / reach);
}

/**
 * A soft white heart in a wide bloom, seen through a camera lens: a faint disc of bokeh, a ring
 * further out, and a starburst whose two long diagonal streaks cross over fainter, shorter ones.
 */
vec4 orb() {
  float fromCenter = length(local);
  float heart = 0.95 * exp(-fromCenter * fromCenter / (0.5 * size * size));
  float bloom = 0.75 * glow(fromCenter, 2.0 * size, 2.5 * size);
  float bokeh = 0.12 * flare * disc(fromCenter, 1.8 * size, 0.5 * size);
  float ring = 0.06 * flare * exp(-pow((fromCenter - 4.5 * size) / (0.7 * size), 2.0));
  float reach = mix(0.5, 1.0, flare) * size;
  float burst = flare * (
    0.3 * (ray(local, tilt + 0.7, 4.0 * reach) + ray(local, tilt - 0.7, 4.0 * reach))
    + 0.12 * (ray(local, tilt + 0.15, 1.5 * reach) + ray(local, tilt + 1.25, 1.5 * reach)
      + ray(local, tilt - 1.0, 1.5 * reach))
  );
  vec3 ringColor = mix(rainbow(seed + atan(local.y, local.x) / (2.0 * PI)), vec3(1.0), 0.6);
  float glowing = bloom + bokeh * (1.0 - bloom);
  float halo = glowing + ring * (1.0 - glowing);
  float lens = min(burst, 1.0);
  vec3 color = colors[1].rgb * glowing + ringColor * ring * (1.0 - glowing);
  color = colors[0].rgb * lens + color * (1.0 - lens);
  float alpha = lens + halo * (1.0 - lens);
  color = colors[0].rgb * heart + color * (1.0 - heart);
  alpha = heart + alpha * (1.0 - heart);
  return vec4(color, alpha) * colors[0].a * opacity;
}

/** Faint stars, one at most in each small cell of the screen, only where there is cloud. */
float stars(float cloudiness) {
  vec2 cell = floor(pixel / 16.0);
  float chance = hash(cell);
  vec2 center = (cell + 0.4 + 0.2 * vec2(hash(cell + 3.7), hash(cell + 9.1))) * 16.0;
  vec2 fromCenter = pixel - center;
  float distance = dot(fromCenter, fromCenter);
  float point = exp(-distance / 4.0) + 0.35 * exp(-distance / 14.0);
  float twinkle = 0.75 + 0.25 * sin(seconds * (0.5 + 2.0 * hash(cell + 1.3)) + chance * 50.0);
  float brightness = 0.4 * mix(0.3, 1.0, hash(cell + 5.9));
  return step(mix(1.01, 0.85, cloudiness), chance) * point * twinkle * brightness;
}

/**
 * The sky as a milky way: long wisps of cloud lying in a band that rises to the right, glowing
 * softly and cut by darker lanes of dust, with the colours of oil on water where the wisps thin
 * out and stars gathering in it.
 */
vec4 clouds() {
  vec2 point = pixel / max(screen.x, screen.y);
  vec2 slanted = mat2(0.94, 0.34, -0.34, 0.94) * point;
  vec2 wisp = slanted * vec2(1.5, 6.0);
  float drift = seconds * 0.01;
  vec2 warp = vec2(
    fbm(wisp * 0.5 + vec2(drift, 0.0)),
    fbm(wisp * 0.5 + vec2(3.1, 7.7) - drift)
  );
  float density = fbm(wisp + 1.8 * warp + vec2(drift * 2.0, 0.0));
  float band = exp(-pow((slanted.y - 0.3) / 0.25, 2.0));
  float core = exp(-pow((slanted.y - 0.3 + 0.04 * (warp.x - 0.5)) / 0.1, 2.0));
  float dust = smoothstep(0.5, 0.72, fbm(wisp * vec2(1.4, 1.8) + warp * 1.2 + 11.0)) * band;
  float cloud = smoothstep(0.42, 0.8, density) * mix(0.3, 1.0, band) * (1.0 - 0.7 * dust);
  float thickness = fbm(wisp * 0.8 + warp * 2.5 - drift);
  vec3 sheen = mix(rainbow(thickness * 3.0 + seconds * 0.005), vec3(1.0), 0.45);
  vec3 color = mix(sheen, colors[2].rgb, smoothstep(0.55, 0.85, density));
  float haze = 0.2 * core * (1.0 - 0.8 * dust);
  float glow = cloud + haze * (1.0 - cloud);
  vec3 lit = (color * cloud + colors[2].rgb * haze * (1.0 - cloud)) / max(glow, 0.001);
  float star = stars(smoothstep(0.1, 0.6, cloud)) * (1.0 - 0.6 * dust);
  float alpha = colors[2].a * glow;
  float total = star + alpha * (1.0 - star);
  return vec4(vec3(1.0) * star + lit * alpha * (1.0 - star), total);
}

void main() {
  vec4 color = kind < 0.5 ? trail() : kind < 1.5 ? orb() : clouds();
  fragColor = dither(color);
}
`,
};

/** Pyreflies: glowing orbs drifting upward on smoky oil-slick wakes, under wisps of cloud. */
export function PyrefliesBackground() {
  return <SceneCanvas scene={PYREFLIES} className="pyreflies" />;
}
