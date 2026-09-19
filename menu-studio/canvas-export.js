(function attachCanvasExport(root, factory) {
  var core = typeof module === "object" && module.exports ? require("./core.js") : root.MenuCore;
  var api = factory(core);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.MenuCanvas = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanvasExport(core) {
  "use strict";

  var MAX_HEIGHT = 30000;

  function wrapText(text, maxWidth, measure) {
    var result = [];
    String(text == null ? "" : text).split(/\r?\n/).forEach(function (paragraph) {
      if (!paragraph) { result.push(""); return; }
      var line = "";
      Array.from(paragraph).forEach(function (character) {
        var candidate = line + character;
        if (line && measure(candidate) > maxWidth) {
          result.push(line);
          line = character;
        } else {
          line = candidate;
        }
      });
      if (line) result.push(line);
    });
    return result.length ? result : [""];
  }

  function calculateCanvasLayout(menu, outputWidth, measure) {
    var width = Number(outputWidth);
    if (width !== 1080 && width !== 2160 && (!Number.isFinite(width) || width < 640)) {
      throw new Error("长图宽度必须是 1080、2160 或至少 640 像素");
    }
    var scale = width / 1080;
    var unitMeasure = typeof measure === "function" ? measure : function (text) { return String(text).length * 16; };
    var margin = 64 * scale;
    var gap = 20 * scale;
    var columns = 4;
    var cardWidth = (width - margin * 2 - gap * (columns - 1)) / columns;
    var mediaHeight = cardWidth;
    var y = 50 * scale;
    var headerHeight = 230 * scale;
    var header = { x: margin, y: y, width: width - margin * 2, height: headerHeight };
    y += headerHeight + 48 * scale;
    var sections = [];

    core.visibleSections(menu).forEach(function (section) {
      var sectionStart = y;
      y += 76 * scale;
      if (section.category.description) {
        y += wrapText(section.category.description, width - margin * 2, function (value) { return unitMeasure(value) * scale; }).length * 26 * scale;
      }
      y += 18 * scale;
      var cards = section.items.map(function (item, index) {
        var descLines = item.description
          ? wrapText(item.description, cardWidth - 40 * scale, function (value) { return unitMeasure(value) * scale; }).length
          : 0;
        var titleLines = wrapText(item.name || "未命名制品", cardWidth - 40 * scale, function (value) { return unitMeasure(value) * 1.12 * scale; }).length;
        var textHeight = 54 * scale + (item.author || item.priceText ? 26 * scale : 0) + descLines * 20 * scale + 20 * scale;
        return {
          item: item,
          column: index % columns,
          row: Math.floor(index / columns),
          x: margin + (index % columns) * (cardWidth + gap),
          y: 0,
          width: cardWidth,
          height: mediaHeight + Math.max(94 * scale, textHeight),
          mediaHeight: mediaHeight,
          titleLines: titleLines,
          descriptionLines: descLines
        };
      });
      var rowCount = Math.ceil(cards.length / columns);
      for (var row = 0; row < rowCount; row += 1) {
        var rowCards = cards.filter(function (card) { return card.row === row; });
        var rowHeight = Math.max.apply(Math, rowCards.map(function (card) { return card.height; }));
        rowCards.forEach(function (card) { card.y = y; card.height = rowHeight; });
        y += rowHeight + gap;
      }
      sections.push({ category: section.category, cards: cards, x: margin, y: sectionStart, width: width - margin * 2, height: y - sectionStart });
      y += 48 * scale;
      if (y > MAX_HEIGHT) throw new Error("菜单长图超过 30000 像素，请减少制品数量或拆分菜单");
    });
    var height = Math.ceil(y + 36 * scale);
    if (height > MAX_HEIGHT) throw new Error("菜单长图超过 30000 像素，请减少制品数量或拆分菜单");
    return { width: width, height: height, scale: scale, margin: margin, gap: gap, columns: columns, header: header, sections: sections };
  }

  function loadImage(source) {
    return new Promise(function (resolve) {
      if (!source) return resolve(null);
      var image = new Image();
      if (!/^data:/i.test(source)) image.crossOrigin = "anonymous";
      image.onload = function () { resolve(image); };
      image.onerror = function () { resolve(null); };
      image.src = source;
    });
  }

  function drawCoverImage(ctx, image, rect, position) {
    if (!image) return;
    var imageRatio = image.width / image.height;
    var rectRatio = rect.width / rect.height;
    var sourceWidth = image.width;
    var sourceHeight = image.height;
    if (imageRatio > rectRatio) sourceWidth = image.height * rectRatio;
    else sourceHeight = image.width / rectRatio;
    var xPercent = Math.max(0, Math.min(100, Number(position && position.x) || 50)) / 100;
    var yPercent = Math.max(0, Math.min(100, Number(position && position.y) || 50)) / 100;
    var sx = (image.width - sourceWidth) * xPercent;
    var sy = (image.height - sourceHeight) * yPercent;
    ctx.drawImage(image, sx, sy, sourceWidth, sourceHeight, rect.x, rect.y, rect.width, rect.height);
  }

  function fillWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    var lines = wrapText(text, maxWidth, function (value) { return ctx.measureText(value).width; });
    if (maxLines) lines = lines.slice(0, maxLines);
    lines.forEach(function (line, index) { ctx.fillText(line, x, y + index * lineHeight); });
    return lines.length * lineHeight;
  }

  async function drawMenu(canvas, menu, layout) {
    var ctx = canvas.getContext("2d");
    var scale = layout.scale;
    var theme = menu.theme;
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(90,96,104,.16)"; ctx.lineWidth = Math.max(1, scale);
    var gridSize = 42 * scale;
    for (var gx = 0; gx <= canvas.width; gx += gridSize) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, canvas.height); ctx.stroke(); }
    for (var gy = 0; gy <= canvas.height; gy += gridSize) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(canvas.width, gy); ctx.stroke(); }

    var infoWidth = layout.header.width * 0.3;
    var infoRect = { x: layout.header.x, y: layout.header.y, width: infoWidth, height: layout.header.height };
    var summaryRect = { x: layout.header.x + infoWidth, y: layout.header.y, width: layout.header.width - infoWidth, height: layout.header.height };
    ctx.fillStyle = theme.primary; ctx.fillRect(infoRect.x, infoRect.y, infoRect.width, infoRect.height);
    ctx.fillStyle = theme.accent; ctx.fillRect(summaryRect.x, summaryRect.y, summaryRect.width, summaryRect.height);
    var cover = await loadImage(menu.stall.coverImage);
    if (cover) {
      drawCoverImage(ctx, cover, infoRect, menu.stall.coverPosition);
      ctx.fillStyle = colorWithAlpha(theme.primary, 0.78); ctx.fillRect(infoRect.x, infoRect.y, infoRect.width, infoRect.height);
    }
    var infoX = infoRect.x + 28 * scale;
    ctx.fillStyle = "rgba(255,255,255,.76)"; ctx.font = "500 " + (12 * scale) + "px sans-serif"; ctx.fillText("摊位号", infoX, infoRect.y + 39 * scale);
    ctx.fillStyle = "#ffffff"; ctx.font = "800 " + (29 * scale) + "px sans-serif"; ctx.fillText(menu.stall.number || "—", infoX, infoRect.y + 71 * scale);
    ctx.fillStyle = "rgba(255,255,255,.76)"; ctx.font = "500 " + (12 * scale) + "px sans-serif"; ctx.fillText("摊位名", infoX, infoRect.y + 111 * scale);
    ctx.fillStyle = "#ffffff"; ctx.font = "850 " + (28 * scale) + "px sans-serif"; fillWrappedText(ctx, menu.stall.name, infoX, infoRect.y + 145 * scale, infoRect.width - 52 * scale, 31 * scale, 2);

    var qr = await loadImage(menu.stall.qrImage);
    var qrSize = qr ? 124 * scale : 0;
    var copyX = summaryRect.x + 32 * scale;
    var copyWidth = summaryRect.width - 64 * scale - (qr ? qrSize + 28 * scale : 0);
    ctx.fillStyle = colorWithAlpha(theme.text, 0.72); ctx.font = "850 " + (12 * scale) + "px sans-serif"; ctx.fillText("MENU NOTE", copyX, summaryRect.y + 43 * scale);
    ctx.fillStyle = theme.text; ctx.font = "400 " + (18 * scale) + "px sans-serif";
    fillWrappedText(ctx, menu.stall.description || "欢迎来摊位看看。", copyX, summaryRect.y + 78 * scale, copyWidth, 27 * scale, 5);
    if (qr) {
      var qrX = summaryRect.x + summaryRect.width - qrSize - 30 * scale;
      var qrY = summaryRect.y + (summaryRect.height - qrSize) / 2 - 10 * scale;
      ctx.fillStyle = "#ffffff"; ctx.fillRect(qrX - 7 * scale, qrY - 7 * scale, qrSize + 14 * scale, qrSize + 14 * scale);
      ctx.drawImage(qr, qrX, qrY, qrSize, qrSize);
      ctx.fillStyle = theme.text; ctx.font = "800 " + (11 * scale) + "px sans-serif"; ctx.textAlign = "center"; ctx.fillText("扫码查看", qrX + qrSize / 2, qrY + qrSize + 27 * scale); ctx.textAlign = "left";
    }

    for (var s = 0; s < layout.sections.length; s += 1) {
      var section = layout.sections[s];
      ctx.fillStyle = theme.primary; ctx.fillRect(section.x, section.y, 8 * scale, 54 * scale);
      ctx.fillStyle = theme.primary; ctx.font = "800 " + (12 * scale) + "px sans-serif"; ctx.fillText("CATEGORY", section.x + 21 * scale, section.y + 14 * scale);
      ctx.fillStyle = theme.text; ctx.font = "900 " + (35 * scale) + "px sans-serif"; ctx.fillText(section.category.name, section.x + 21 * scale, section.y + 51 * scale);
      ctx.fillStyle = colorWithAlpha(theme.text, 0.62); ctx.font = "400 " + (17 * scale) + "px sans-serif";
      if (section.category.description) fillWrappedText(ctx, section.category.description, section.x, section.y + 83 * scale, section.width, 24 * scale);
      for (var c = 0; c < section.cards.length; c += 1) await drawCard(ctx, section.cards[c], theme, scale);
    }
  }

  async function drawCard(ctx, card, theme, scale) {
    ctx.fillStyle = theme.surface; ctx.fillRect(card.x, card.y, card.width, card.mediaHeight);
    var image = await loadImage(card.item.image);
    if (image) drawCoverImage(ctx, image, { x: card.x, y: card.y, width: card.width, height: card.mediaHeight }, card.item.imagePosition);
    else {
      ctx.fillStyle = colorWithAlpha(theme.text, 0.45); ctx.font = "800 " + (16 * scale) + "px sans-serif"; ctx.textAlign = "center"; ctx.fillText("制品图片", card.x + card.width / 2, card.y + card.mediaHeight / 2); ctx.textAlign = "left";
    }
    if (card.item.badgeText) {
      var badgeRadius = 28 * scale;
      var badgeX = card.x + card.width - badgeRadius - 9 * scale;
      var badgeY = card.y + badgeRadius + 9 * scale;
      ctx.fillStyle = theme.primary; ctx.beginPath(); ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "800 " + (12 * scale) + "px sans-serif"; ctx.textAlign = "center"; ctx.fillText(card.item.badgeText, badgeX, badgeY + 4 * scale); ctx.textAlign = "left";
    }
    var titleY = card.y + card.mediaHeight;
    var titleHeight = 52 * scale;
    ctx.fillStyle = theme.primary; ctx.fillRect(card.x, titleY, card.width, titleHeight);
    var x = card.x + 12 * scale; var textWidth = card.width - 24 * scale;
    ctx.fillStyle = "#ffffff"; ctx.font = "850 " + (15 * scale) + "px sans-serif";
    var nameWidth = card.item.priceText ? textWidth - 64 * scale : textWidth;
    fillWrappedText(ctx, card.item.name, x, titleY + 21 * scale, nameWidth, 17 * scale, 2);
    if (card.item.priceText) { ctx.font = "900 " + (13 * scale) + "px sans-serif"; ctx.textAlign = "right"; ctx.fillText(card.item.priceText, card.x + card.width - 12 * scale, titleY + 29 * scale); ctx.textAlign = "left"; }
    var metaY = titleY + titleHeight + 20 * scale;
    if (card.item.author) { ctx.fillStyle = theme.primary; ctx.font = "800 " + (12 * scale) + "px sans-serif"; ctx.fillText("作者：" + card.item.author, x, metaY); metaY += 21 * scale; }
    if (card.item.description) { ctx.fillStyle = colorWithAlpha(theme.text, 0.72); ctx.font = "400 " + (12 * scale) + "px sans-serif"; fillWrappedText(ctx, card.item.description, x, metaY, textWidth, 20 * scale); }
  }

  function colorWithAlpha(hex, alpha) {
    var value = String(hex).replace("#", "");
    var red = parseInt(value.slice(0, 2), 16); var green = parseInt(value.slice(2, 4), 16); var blue = parseInt(value.slice(4, 6), 16);
    return "rgba(" + red + "," + green + "," + blue + "," + alpha + ")";
  }

  async function exportMenuPng(menu, width) {
    if (typeof document === "undefined") throw new Error("PNG 导出只能在浏览器中使用");
    core.validateMenu(menu);
    var probe = document.createElement("canvas").getContext("2d"); probe.font = "16px sans-serif";
    var layout = calculateCanvasLayout(menu, width || 1080, function (text) { return probe.measureText(text).width; });
    var canvas = document.createElement("canvas"); canvas.width = layout.width; canvas.height = layout.height;
    await drawMenu(canvas, menu, layout);
    var blob = await new Promise(function (resolve, reject) { canvas.toBlob(function (value) { value ? resolve(value) : reject(new Error("无法生成 PNG，请检查图片来源")); }, "image/png"); });
    var url = URL.createObjectURL(blob); var link = document.createElement("a");
    link.href = url; link.download = (menu.stall.name || "摊位菜单").replace(/[\\/:*?\"<>|]/g, "-") + "-长图.png"; link.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    return { width: layout.width, height: layout.height };
  }

  return { MAX_HEIGHT: MAX_HEIGHT, calculateCanvasLayout: calculateCanvasLayout, drawMenu: drawMenu, exportMenuPng: exportMenuPng, wrapText: wrapText };
});
