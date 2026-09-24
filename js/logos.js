import * as THREE from "three";

export const LOGO_STYLES = [
  { id: "circle", label: "Circle" },
  { id: "shield", label: "Shield" },
  { id: "square", label: "Square" },
  { id: "hex", label: "Hexagon" },
  { id: "outline", label: "Outline" },
  { id: "luxury", label: "Luxury" },
  { id: "seal", label: "Seal" },
  { id: "banner", label: "Banner" },
  { id: "plain", label: "Image only" },
];

export const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    this.moveTo(x + rad, y);
    this.arcTo(x + w, y, x + w, y + h, rad);
    this.arcTo(x + w, y + h, x, y + h, rad);
    this.arcTo(x, y + h, x, y, rad);
    this.arcTo(x, y, x + w, y, rad);
    this.closePath();
  };
}

function clipShape(ctx, style, cx, cy, r) {
  ctx.beginPath();
  if (style === "shield") {
    ctx.moveTo(cx, cy - r * 0.95);
    ctx.lineTo(cx + r * 0.82, cy - r * 0.55);
    ctx.lineTo(cx + r * 0.78, cy + r * 0.15);
    ctx.quadraticCurveTo(cx + r * 0.7, cy + r * 0.72, cx, cy + r * 0.98);
    ctx.quadraticCurveTo(cx - r * 0.7, cy + r * 0.72, cx - r * 0.78, cy + r * 0.15);
    ctx.lineTo(cx - r * 0.82, cy - r * 0.55);
    ctx.closePath();
  } else if (style === "square" || style === "luxury" || style === "plain") {
    const s = r * 0.92;
    const rad = style === "luxury" ? 28 : 56;
    ctx.roundRect(cx - s, cy - s, s * 2, s * 2, rad);
  } else if (style === "hex") {
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  } else {
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
  }
}

function drawImageCover(ctx, img, x, y, w, h) {
  const ir = img.width / img.height;
  const tr = w / h;
  let dw = w;
  let dh = h;
  let dx = x;
  let dy = y;
  if (ir > tr) {
    dw = h * ir;
    dx = x - (dw - w) / 2;
  } else {
    dh = w / ir;
    dy = y - (dh - h) / 2;
  }
  ctx.drawImage(img, dx, dy, dw, dh);
}

export function makeLogoTexture({
  letter = "A",
  style = "circle",
  fg = "#f4efe6",
  bg = "#11141a",
  word = "",
  image = null,
} = {}) {
  const size = 512;
  const k = size / 1024;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2;
  const cy = word ? size * 0.46 : size / 2;
  const r = size * 0.38;
  const mono = String(letter || "A")
    .toUpperCase()
    .replace(/[^A-Z0-9&]/g, "")
    .slice(0, 3) || "A";

  if (style === "plain") {
    if (image) {
      ctx.drawImage(image, 40, 40, size - 80, size - 80);
    } else {
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.roundRect(80 * k, 80 * k, size - 160 * k, size - 160 * k, 48 * k);
      ctx.fill();
      ctx.fillStyle = fg;
      ctx.font = `700 ${Math.round((mono.length > 1 ? 280 : 420) * k)}px Sora, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(mono, cx, cy);
    }
  } else {
    ctx.save();
    clipShape(ctx, style, cx, cy, r);
    ctx.fillStyle = bg;
    ctx.fill();
    if (image) {
      ctx.clip();
      drawImageCover(ctx, image, cx - r, cy - r, r * 2, r * 2);
      ctx.restore();
      ctx.save();
      clipShape(ctx, style, cx, cy, r);
    } else {
      ctx.clip();
      const glow = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.3, 20, cx, cy, r);
      glow.addColorStop(0, "rgba(255,255,255,0.1)");
      glow.addColorStop(1, "rgba(0,0,0,0.18)");
      ctx.fillStyle = glow;
      ctx.fill();
      ctx.restore();
      ctx.save();
      clipShape(ctx, style, cx, cy, r);
    }

    ctx.lineWidth = (style === "outline" ? 18 : 10) * k;
    ctx.strokeStyle = fg;
    ctx.stroke();
    ctx.restore();

    if (style === "outline") {
      ctx.save();
      clipShape(ctx, "circle", cx, cy, r * 0.86);
      ctx.lineWidth = 6 * k;
      ctx.strokeStyle = fg;
      ctx.stroke();
      ctx.restore();
    }

    if (style === "seal") {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
      ctx.lineWidth = 5 * k;
      ctx.strokeStyle = fg;
      ctx.stroke();
      ctx.fillStyle = fg;
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9, 5 * k, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (style === "luxury") {
      ctx.strokeStyle = fg;
      ctx.lineWidth = 3 * k;
      ctx.strokeRect(cx - r * 0.62, cy - r * 0.62, r * 1.24, r * 1.24);
    }

    if (!image) {
      ctx.fillStyle = fg;
      const fontSize = Math.round((mono.length === 3 ? 210 : mono.length === 2 ? 280 : 360) * k);
      ctx.font = style === "luxury" ? `600 ${fontSize}px Georgia, serif` : `700 ${fontSize}px Sora, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(mono, cx, cy + (style === "banner" ? -18 : 8) * k);
    }

    if (style === "banner") {
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.78, cy + r * 0.42);
      ctx.lineTo(cx + r * 0.78, cy + r * 0.42);
      ctx.lineTo(cx + r * 0.7, cy + r * 0.68);
      ctx.lineTo(cx - r * 0.7, cy + r * 0.68);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = bg;
      ctx.font = `700 ${Math.round(54 * k)}px Sora, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText((word || "BRAND").toUpperCase().slice(0, 12), cx, cy + r * 0.55);
    }
  }

  if (word && style !== "banner" && style !== "plain") {
    ctx.fillStyle = fg;
    ctx.font = `600 ${Math.round(58 * k)}px Sora, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.letterSpacing = "8px";
    ctx.fillText(String(word).toUpperCase().slice(0, 16), cx, size * 0.88);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 2;
  tex.needsUpdate = true;
  return tex;
}
