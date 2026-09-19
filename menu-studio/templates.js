(function attachMenuTemplates(root, factory) {
  var core = typeof module === "object" && module.exports
    ? require("./core.js")
    : root.MenuCore;
  var api = factory(core);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.MenuTemplates = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createMenuTemplates(core) {
  "use strict";

  if (!core) throw new Error("MenuCore is required before MenuTemplates");

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function safeLink(value) {
    try {
      return core.normalizeExternalUrl(value);
    } catch (_error) {
      return "";
    }
  }

  function safeImageSource(value) {
    var source = String(value || "").trim();
    if (/^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=\s]+$/i.test(source)) return source;
    return safeLink(source);
  }

  function safeColor(value, fallback) {
    return core.validateColor(value) ? value : fallback;
  }

  function gridColumnsForWidth(width) {
    var value = Number(width) || 0;
    if (value <= 370) return 1;
    if (value <= 680) return 2;
    if (value <= 960) return 3;
    return 4;
  }

  function renderImage(item) {
    var source = safeImageSource(item.image);
    if (!source) {
      return '<div class="menu-card-placeholder" aria-hidden="true"><span>制品图片</span></div>';
    }
    var x = Math.max(0, Math.min(100, Number(item.imagePosition && item.imagePosition.x) || 50));
    var y = Math.max(0, Math.min(100, Number(item.imagePosition && item.imagePosition.y) || 50));
    return '<img class="menu-card-image" src="' + escapeHtml(source) + '" alt="' + escapeHtml(item.name) + '" style="object-position:' + x + '% ' + y + '%" loading="lazy">';
  }

  function renderProductCard(item) {
    var href = safeLink(item.targetUrl);
    var opening = href
      ? '<a class="menu-card menu-card-clickable" href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer" aria-label="查看 ' + escapeHtml(item.name || "未命名制品") + '">'
      : '<article class="menu-card">';
    var closing = href ? '</a>' : '</article>';
    var body = [
      opening,
      '<div class="menu-card-media">',
      renderImage(item),
      item.badgeText ? '<span class="menu-card-badge">' + escapeHtml(item.badgeText) + '</span>' : "",
      '</div>',
      '<div class="menu-card-body">',
      '<div class="menu-card-heading">',
      '<h3>' + escapeHtml(item.name || "未命名制品") + '</h3>',
      item.priceText ? '<span class="menu-card-price">' + escapeHtml(item.priceText) + '</span>' : "",
      '</div>',
      item.author ? '<p class="menu-card-author">作者：' + escapeHtml(item.author) + '</p>' : "",
      item.description ? '<p class="menu-card-description">' + escapeHtml(item.description) + '</p>' : "",
      href ? '<span class="menu-card-link">查看详情 <span aria-hidden="true">↗</span></span>' : "",
      '</div>',
      closing
    ];
    return body.join("");
  }

  function renderHeader(menu) {
    var cover = safeImageSource(menu.stall.coverImage);
    var qrImage = safeImageSource(menu.stall.qrImage);
    var x = Math.max(0, Math.min(100, Number(menu.stall.coverPosition && menu.stall.coverPosition.x) || 50));
    var y = Math.max(0, Math.min(100, Number(menu.stall.coverPosition && menu.stall.coverPosition.y) || 50));
    var panelStyle = cover
      ? 'background-image:linear-gradient(rgba(0,0,0,.42),rgba(0,0,0,.42)),url(&quot;' + escapeHtml(cover) + '&quot;);background-position:' + x + '% ' + y + '%'
      : '';
    var home = safeLink(menu.stall.homeUrl);
    return [
      '<header class="stall-header">',
      '<section class="stall-info-panel"' + (panelStyle ? ' style="' + panelStyle + '"' : '') + '>',
      '<p class="stall-label">摊位号</p>',
      '<p class="stall-number">' + escapeHtml(menu.stall.number || "—") + '</p>',
      '<p class="stall-label">摊位名</p>',
      '<h1>' + escapeHtml(menu.stall.name || "我的摊位菜单") + '</h1>',
      '</section>',
      '<section class="stall-summary-panel">',
      '<div class="stall-summary-copy">',
      '<p class="stall-summary-kicker">MENU NOTE</p>',
      menu.stall.description ? '<p class="stall-description">' + escapeHtml(menu.stall.description) + '</p>' : "",
      home ? '<a class="stall-home" href="' + escapeHtml(home) + '" target="_blank" rel="noopener noreferrer">访问摊主主页 <span aria-hidden="true">↗</span></a>' : "",
      '</div>',
      qrImage ? '<figure class="stall-qr"><img class="stall-qr-image" src="' + escapeHtml(qrImage) + '" alt="摊位二维码"><figcaption>扫码查看</figcaption></figure>' : "",
      '</section>',
      '</header>'
    ].join("");
  }

  function renderMenuMarkup(menu) {
    var normalized = core.cloneMenu(menu);
    var theme = normalized.theme || {};
    var sections = core.visibleSections(normalized);
    var style = [
      "--menu-primary:" + safeColor(theme.primary, core.DEFAULT_THEME.primary),
      "--menu-background:" + safeColor(theme.background, core.DEFAULT_THEME.background),
      "--menu-surface:" + safeColor(theme.surface, core.DEFAULT_THEME.surface),
      "--menu-text:" + safeColor(theme.text, core.DEFAULT_THEME.text),
      "--menu-accent:" + safeColor(theme.accent, core.DEFAULT_THEME.accent)
    ].join(";");
    var navigation = sections.length > 1
      ? '<nav class="category-nav" aria-label="菜单分类">' + sections.map(function (section) {
          return '<a href="#category-' + escapeHtml(section.category.id) + '">' + escapeHtml(section.category.name) + '</a>';
        }).join("") + '</nav>'
      : "";
    var content = sections.length
      ? sections.map(function (section) {
          return [
            '<section class="menu-section" id="category-' + escapeHtml(section.category.id) + '">',
            '<div class="section-heading">',
            '<div><p class="section-kicker">CATEGORY</p><h2>' + escapeHtml(section.category.name) + '</h2></div>',
            '<span class="section-count">' + section.items.length + ' 项</span>',
            '</div>',
            section.category.description ? '<p class="section-description">' + escapeHtml(section.category.description) + '</p>' : "",
            '<div class="menu-grid">' + section.items.map(renderProductCard).join("") + '</div>',
            '</section>'
          ].join("");
        }).join("")
      : '<section class="menu-empty"><p>菜单还没有制品，稍后再来看看吧。</p></section>';
    return [
      '<main class="menu-document" style="' + escapeHtml(style) + '">',
      '<div class="menu-inner">',
      renderHeader(normalized),
      navigation,
      content,
      '<footer class="menu-footer"><span>电子菜单</span><span>点击带箭头的制品即可打开链接</span></footer>',
      '</div>',
      '</main>'
    ].join("");
  }

  var STANDALONE_CSS = [
    "*{box-sizing:border-box}",
    "html{scroll-behavior:smooth}",
    "body{margin:0;background:#e9eef2;color:#172033;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif}",
    "a{color:inherit}",
    ".menu-document{min-height:100vh;color:var(--menu-text);padding:clamp(18px,4vw,54px);background-color:var(--menu-background);background-image:linear-gradient(to right,#d9dcdf 1px,transparent 1px),linear-gradient(to bottom,#d9dcdf 1px,transparent 1px);background-size:42px 42px}",
    ".menu-inner{max-width:1180px;margin:0 auto}",
    ".stall-header{display:grid;grid-template-columns:minmax(220px,30%) 1fr;min-height:220px;color:#fff}",
    ".stall-info-panel{display:flex;flex-direction:column;justify-content:center;padding:30px;background-color:var(--menu-primary);background-size:cover;color:#fff}",
    ".stall-label{margin:0 0 4px;font-size:12px;opacity:.78}",
    ".stall-number{margin:0 0 19px;font-size:30px;font-weight:800;line-height:1}",
    ".stall-info-panel h1{margin:0;font-size:clamp(26px,3.4vw,46px);line-height:1.08;letter-spacing:-.04em}",
    ".stall-summary-panel{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:34px;padding:28px 34px;background:var(--menu-accent);color:var(--menu-text)}",
    ".stall-summary-copy{min-width:0}",
    ".stall-summary-kicker,.section-kicker{margin:0 0 10px;font-size:11px;font-weight:850;letter-spacing:.16em}",
    ".stall-description{max-width:36em;margin:0;white-space:pre-line;line-height:1.65}",
    ".stall-home{display:inline-block;margin-top:16px;font-weight:800;text-underline-offset:4px}",
    ".stall-qr{width:128px;margin:0;text-align:center}",
    ".stall-qr-image{display:block;width:100%;aspect-ratio:1;object-fit:contain;padding:5px;background:#fff}",
    ".stall-qr figcaption{margin-top:7px;font-size:11px;font-weight:800;letter-spacing:.08em}",
    ".category-nav{position:sticky;top:10px;z-index:4;display:flex;gap:20px;overflow-x:auto;margin:18px 0 0;padding:10px 0;background:color-mix(in srgb,var(--menu-background),transparent 8%);backdrop-filter:blur(12px)}",
    ".category-nav a{flex:0 0 auto;text-decoration:none;font-size:13px;font-weight:850;border-bottom:3px solid transparent}",
    ".category-nav a:hover{border-color:var(--menu-primary)}",
    ".menu-section{padding:clamp(28px,4vw,46px) 0}",
    ".section-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:10px}",
    ".section-heading>div{padding-left:13px;border-left:8px solid var(--menu-primary)}",
    ".section-heading h2{margin:0;font-size:clamp(28px,3.3vw,42px);letter-spacing:-.04em}",
    ".section-kicker{color:var(--menu-primary)}",
    ".section-count{font-size:13px;font-weight:800;color:color-mix(in srgb,var(--menu-text),transparent 40%)}",
    ".section-description{max-width:52em;margin:0 0 22px;line-height:1.65;color:color-mix(in srgb,var(--menu-text),transparent 28%)}",
    ".menu-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}",
    ".menu-card{display:block;min-width:0;background:transparent;text-decoration:none}",
    ".menu-card-clickable{cursor:pointer}",
    ".menu-card-media{position:relative;aspect-ratio:1;background:var(--menu-surface);overflow:hidden}",
    ".menu-card-image{display:block;width:100%;height:100%;object-fit:cover;transition:transform .25s ease}",
    ".menu-card-clickable:hover .menu-card-image{transform:scale(1.02)}",
    ".menu-card-placeholder{height:100%;display:grid;place-items:center;color:color-mix(in srgb,var(--menu-text),transparent 45%);font-weight:800;background:var(--menu-surface)}",
    ".menu-card-badge{position:absolute;top:9px;right:9px;display:grid;place-items:center;min-width:54px;min-height:54px;padding:8px;border-radius:50%;background:var(--menu-primary);color:#fff;font-size:12px;font-weight:850;text-align:center}",
    ".menu-card-body{padding:0}",
    ".menu-card-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:48px;padding:10px 12px;background:var(--menu-primary);color:#fff}",
    ".menu-card-heading h3{margin:0;font-size:15px;line-height:1.25}",
    ".menu-card-price{flex:0 0 auto;font-size:13px;font-weight:900}",
    ".menu-card-author{margin:10px 0 0;color:var(--menu-primary);font-size:12px;font-weight:850}",
    ".menu-card-description{margin:5px 0 0;color:color-mix(in srgb,var(--menu-text),transparent 24%);font-size:12px;line-height:1.5}",
    ".menu-card-link{display:inline-block;margin-top:7px;color:var(--menu-primary);font-size:12px;font-weight:850}",
    ".menu-empty{margin:34px 0;padding:48px 24px;text-align:center;background:color-mix(in srgb,var(--menu-surface),transparent 28%)}",
    ".menu-footer{display:flex;justify-content:space-between;gap:20px;padding:24px 0;color:color-mix(in srgb,var(--menu-text),transparent 42%);font-size:12px;font-weight:700}",
    "@media(max-width:960px){.menu-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.stall-header{grid-template-columns:minmax(190px,34%) 1fr}.stall-summary-panel{gap:20px}.stall-qr{width:104px}}",
    "@media(max-width:680px){.menu-document{padding:10px;background-size:28px 28px}.stall-header{grid-template-columns:1fr}.stall-info-panel{min-height:150px;padding:24px}.stall-summary-panel{grid-template-columns:minmax(0,1fr) 86px;padding:22px;gap:16px}.stall-qr{width:86px}.category-nav{top:6px;margin-top:10px}.menu-section{padding:30px 0}.menu-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 10px}.menu-card-heading{min-height:44px;padding:8px}.menu-card-heading h3{font-size:13px}.menu-card-author,.menu-card-description,.menu-card-link{font-size:11px}.menu-footer{display:block}.menu-footer span{display:block;margin-top:6px}}",
    "@media(max-width:370px){.menu-grid{grid-template-columns:1fr}}",
    "@media print{body{background:#fff}.menu-document{padding:0}.category-nav{display:none}.menu-section{break-inside:avoid}.menu-card-link{display:none}}"
  ].join("");

  function serializeForScript(value) {
    return JSON.stringify(value)
      .replace(/&/g, "\\u0026")
      .replace(/</g, "\\u003c")
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029");
  }

  function createStandaloneHtml(menu) {
    core.validateMenu(menu);
    var title = (menu.stall.name || "我的摊位") + " · 电子菜单";
    return [
      '<!doctype html>',
      '<html lang="zh-CN">',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<meta name="color-scheme" content="light">',
      '<title>' + escapeHtml(title) + '</title>',
      '<style>' + STANDALONE_CSS + '</style>',
      '</head>',
      '<body>',
      renderMenuMarkup(menu),
      '<script type="application/json" id="menu-data">' + serializeForScript(menu) + '</script>',
      '</body>',
      '</html>'
    ].join("");
  }

  return {
    STANDALONE_CSS: STANDALONE_CSS,
    createStandaloneHtml: createStandaloneHtml,
    escapeHtml: escapeHtml,
    gridColumnsForWidth: gridColumnsForWidth,
    renderMenuMarkup: renderMenuMarkup,
    safeImageSource: safeImageSource,
    safeLink: safeLink,
    serializeForScript: serializeForScript
  };
});
