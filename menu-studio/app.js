(function startMenuApp(core, templates) {
  "use strict";
  var STORAGE_KEY = "menu-studio-draft-v1";
  var state = loadDraft();
  var lastDeleted = null;
  var saveTimer = null;
  var toastTimer = null;
  var editor = document.getElementById("editorPane");
  var preview = document.getElementById("previewFrame");
  var categoryEditor = document.getElementById("categoryEditor");

  function sampleMenu() {
    var menu = core.createDefaultMenu();
    menu.stall.name = "摊位名";
    menu.stall.number = "摊位号";
    menu.stall.description = "描述";
    menu.items = [
      makeItem(menu.categories[0].id, "制品1", "你", "无料交换", "无料", "出示关注即可领取，每人一份。"),
      makeItem(menu.categories[0].id, "制品2", "你", "无料交换", "无料", "任选一张，送完为止。"),
      makeItem(menu.categories[0].id, "制品3", "你", "无料交换", "无料", "现场交换限定。"),
      makeItem(menu.categories[0].id, "制品4", "你", "免费领取", "无料", "摊位限定纪念票根。"),
      makeItem(menu.categories[1].id, "制品5", "你", "¥35", "NEW", "双面印刷，约 7cm。"),
      makeItem(menu.categories[2].id, "制品6", "你", "¥20", "寄售", "珠光纸印刷，A5 尺寸。")
    ];
    return menu;
  }

  function makeItem(categoryId, name, author, priceText, badgeText, description) {
    return { id: core.makeId("item"), categoryId: categoryId, name: name, author: author, priceText: priceText, badgeText: badgeText, description: description, targetUrl: "", image: "", imagePosition: { x: 50, y: 50 }, sortOrder: state && state.items ? state.items.length : 0 };
  }

  function loadDraft() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        var parsed = JSON.parse(stored);
        core.validateMenu(parsed);
        return parsed;
      }
    } catch (_error) {}
    return sampleMenu();
  }

  function dispatch(action, options) {
    try {
      state = core.menuReducer(state, action);
      render(Boolean(options && options.keepEditor));
      queueSave();
    } catch (error) {
      showToast(error.message, true);
    }
  }

  function queueSave() {
    var saveState = document.getElementById("saveState");
    saveState.querySelector("span").textContent = "正在保存…";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        saveState.querySelector("span").textContent = "已保存到本机";
      } catch (_error) {
        saveState.querySelector("span").textContent = "图片过大，无法自动保存";
      }
    }, 180);
  }

  function render(keepEditor) {
    syncStaticFields();
    if (!keepEditor) renderCategories();
    preview.innerHTML = '<style>' + templates.STANDALONE_CSS + '</style>' + templates.renderMenuMarkup(state);
  }

  function syncStaticFields() {
    document.querySelectorAll("[name^='stall.'],[name^='theme.']").forEach(function (input) {
      if (input.type === "file") return;
      var parts = input.name.split(".");
      var value = state[parts[0]];
      for (var i = 1; i < parts.length; i += 1) value = value[parts[i]];
      if (document.activeElement !== input) input.value = value == null ? "" : value;
    });
  }

  function renderCategories() {
    categoryEditor.innerHTML = "";
    state.categories.slice().sort(sortOrder).forEach(function (category) {
      var node = document.getElementById("categoryTemplate").content.firstElementChild.cloneNode(true);
      node.dataset.categoryId = category.id;
      node.querySelector(".category-name").value = category.name;
      node.querySelector(".category-description").value = category.description || "";
      var list = node.querySelector(".item-list");
      state.items.filter(function (item) { return item.categoryId === category.id; }).sort(sortOrder).forEach(function (item, index) {
        list.appendChild(renderItem(item, index));
      });
      categoryEditor.appendChild(node);
    });
  }

  function renderItem(item, index) {
    var node = document.getElementById("itemTemplate").content.firstElementChild.cloneNode(true);
    node.dataset.itemId = item.id;
    node.querySelector(".item-index").textContent = "制品 " + (index + 1);
    node.querySelectorAll("[data-item-field]").forEach(function (input) { input.value = item[input.dataset.itemField] || ""; });
    node.querySelectorAll("[data-item-position]").forEach(function (input) { input.value = item.imagePosition[input.dataset.itemPosition]; });
    if (item.image) node.querySelector("[data-item-image] + b + em").textContent = "已添加图片";
    return node;
  }

  function sortOrder(a, b) { return Number(a.sortOrder || 0) - Number(b.sortOrder || 0); }

  function updateByInput(input) {
    if (input.name && input.name.indexOf("stall.") === 0) {
      var stallPath = input.name.split(".").slice(1);
      if (stallPath[0] === "coverPosition") {
        var coverPosition = Object.assign({}, state.stall.coverPosition);
        coverPosition[stallPath[1]] = Number(input.value);
        dispatch({ type: "stall/update", patch: { coverPosition: coverPosition } }, { keepEditor: true });
      } else {
        var patch = {}; patch[stallPath[0]] = input.value;
        dispatch({ type: "stall/update", patch: patch }, { keepEditor: true });
      }
      return;
    }
    if (input.name && input.name.indexOf("theme.") === 0) {
      var themePatch = {}; themePatch[input.name.split(".")[1]] = input.value;
      dispatch({ type: "theme/update", patch: themePatch }, { keepEditor: true });
      return;
    }
    var categoryNode = input.closest("[data-category-id]");
    var itemNode = input.closest("[data-item-id]");
    if (itemNode && input.dataset.itemField) {
      var itemPatch = {}; itemPatch[input.dataset.itemField] = input.value;
      dispatch({ type: "item/update", id: itemNode.dataset.itemId, patch: itemPatch }, { keepEditor: true });
    } else if (itemNode && input.dataset.itemPosition) {
      var item = state.items.find(function (entry) { return entry.id === itemNode.dataset.itemId; });
      var position = Object.assign({}, item.imagePosition); position[input.dataset.itemPosition] = Number(input.value);
      dispatch({ type: "item/update", id: item.id, patch: { imagePosition: position } }, { keepEditor: true });
    } else if (categoryNode && input.classList.contains("category-name")) {
      dispatch({ type: "category/update", id: categoryNode.dataset.categoryId, patch: { name: input.value || "未命名分类" } }, { keepEditor: true });
    } else if (categoryNode && input.classList.contains("category-description")) {
      dispatch({ type: "category/update", id: categoryNode.dataset.categoryId, patch: { description: input.value } }, { keepEditor: true });
    }
  }

  function handleAction(button) {
    var action = button.dataset.action;
    var categoryNode = button.closest("[data-category-id]");
    var itemNode = button.closest("[data-item-id]");
    if (action === "add-category") {
      dispatch({ type: "category/add", category: { id: core.makeId("category"), name: "新分类", description: "", sortOrder: state.categories.length } });
    } else if (action === "add-item") {
      dispatch({ type: "item/add", item: makeItem(categoryNode.dataset.categoryId, "新制品", "", "", "", "") });
    } else if (action === "category-up" || action === "category-down") {
      dispatch({ type: "category/move", id: categoryNode.dataset.categoryId, direction: action === "category-up" ? -1 : 1 });
    } else if (action === "item-up" || action === "item-down") {
      dispatch({ type: "item/move", id: itemNode.dataset.itemId, direction: action === "item-up" ? -1 : 1 });
    } else if (action === "delete-item") {
      var deleted = state.items.find(function (item) { return item.id === itemNode.dataset.itemId; });
      lastDeleted = { type: "item", value: core.cloneMenu(deleted) };
      dispatch({ type: "item/delete", id: deleted.id }); showUndo("已删除“" + deleted.name + "”");
    } else if (action === "delete-category") {
      deleteCategory(categoryNode.dataset.categoryId);
    } else if (action === "undo") {
      undoDelete();
    } else if (action === "export-html") {
      exportHtml();
    } else if (action === "export-json") {
      downloadText(fileName("草稿", "json"), JSON.stringify(state, null, 2), "application/json");
    } else if (action === "export-png") {
      if (window.MenuCanvas) window.MenuCanvas.exportMenuPng(state, 1440).catch(function (error) { showToast(error.message, true); });
      else showToast("长图功能正在载入，请稍后再试", true);
    } else if (action === "print") {
      window.print();
    } else if (action === "reset") {
      if (confirm("新建菜单会清除当前草稿，确定继续吗？")) { state = sampleMenu(); render(); queueSave(); showToast("已新建菜单"); }
    }
  }

  function deleteCategory(id) {
    if (state.categories.length <= 1) return showToast("至少保留一个分类", true);
    var category = state.categories.find(function (entry) { return entry.id === id; });
    var items = state.items.filter(function (item) { return item.categoryId === id; });
    if (items.length && !confirm("这个分类里有 " + items.length + " 个制品。删除分类会一起删除它们，确定吗？")) return;
    lastDeleted = { type: "category", value: core.cloneMenu(category), items: core.cloneMenu(items) };
    dispatch({ type: "category/delete", id: id, deleteItems: true }); showUndo("已删除“" + category.name + "”");
  }

  function undoDelete() {
    if (!lastDeleted) return;
    if (lastDeleted.type === "item") dispatch({ type: "item/restore", item: lastDeleted.value });
    else {
      dispatch({ type: "category/add", category: lastDeleted.value });
      lastDeleted.items.forEach(function (item) { state = core.menuReducer(state, { type: "item/restore", item: item }); });
      render(); queueSave();
    }
    lastDeleted = null; document.getElementById("undoBar").hidden = true; showToast("已撤销删除");
  }

  function showUndo(text) {
    document.getElementById("undoText").textContent = text;
    document.getElementById("undoBar").hidden = false;
    setTimeout(function () { document.getElementById("undoBar").hidden = true; lastDeleted = null; }, 7000);
  }

  function readImage(file, callback) {
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) return showToast("单张图片请控制在 6MB 以内", true);
    var reader = new FileReader();
    reader.onload = function () { callback(reader.result); };
    reader.onerror = function () { showToast("图片读取失败", true); };
    reader.readAsDataURL(file);
  }

  function exportHtml() {
    try {
      core.validateMenu(state);
      downloadText(fileName("电子菜单", "html"), templates.createStandaloneHtml(state), "text/html;charset=utf-8");
      showToast("电子菜单已导出");
    } catch (error) { showToast(error.message, true); }
  }

  function fileName(label, extension) {
    return (state.stall.name || "摊位菜单").replace(/[\\/:*?\"<>|]/g, "-") + "-" + label + "." + extension;
  }

  function downloadText(name, content, type) {
    var url = URL.createObjectURL(new Blob([content], { type: type }));
    var link = document.createElement("a"); link.href = url; link.download = name; link.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function showToast(message, isError) {
    var toast = document.getElementById("toast"); toast.textContent = message;
    toast.className = "toast show" + (isError ? " error" : "");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toast.className = "toast"; }, 2200);
  }

  editor.addEventListener("input", function (event) { updateByInput(event.target); });
  document.addEventListener("click", function (event) {
    var action = event.target.closest("[data-action]"); if (action) handleAction(action);
    var palette = event.target.closest("[data-palette]"); if (palette) applyPalette(palette.dataset.palette);
    var size = event.target.closest("[data-preview-size]"); if (size) {
      document.querySelectorAll("[data-preview-size]").forEach(function (button) { button.classList.toggle("active", button === size); });
      preview.classList.toggle("mobile", size.dataset.previewSize === "mobile");
    }
    var mobileView = event.target.closest("[data-mobile-view]"); if (mobileView) switchMobileView(mobileView.dataset.mobileView);
  });
  editor.addEventListener("change", function (event) {
    var input = event.target;
    if (input.name === "stall.coverImage") readImage(input.files[0], function (data) { dispatch({ type: "stall/update", patch: { coverImage: data } }); input.closest(".file-control").querySelector("em").textContent = input.files[0].name; });
    if (input.name === "stall.qrImage") readImage(input.files[0], function (data) { dispatch({ type: "stall/update", patch: { qrImage: data } }); input.closest(".file-control").querySelector("em").textContent = input.files[0].name; });
    if (input.matches("[data-item-image]")) {
      var id = input.closest("[data-item-id]").dataset.itemId;
      readImage(input.files[0], function (data) { dispatch({ type: "item/update", id: id, patch: { image: data } }); });
    }
  });
  document.getElementById("importJson").addEventListener("change", function (event) {
    var file = event.target.files[0]; if (!file) return;
    var reader = new FileReader(); reader.onload = function () {
      try { var imported = JSON.parse(reader.result); core.validateMenu(imported); state = imported; render(); queueSave(); showToast("草稿已导入"); }
      catch (error) { showToast("无法导入：" + error.message, true); }
    }; reader.readAsText(file);
  });

  function applyPalette(name) {
    var palettes = {
      poster: { primary: "#8586ce", accent: "#cfaa83", background: "#faf9f4", surface: "#d3b08c", text: "#303133" },
      ocean: { primary: "#155e75", accent: "#f97316", background: "#f7fbff", surface: "#ffffff", text: "#172033" },
      berry: { primary: "#7c2d5b", accent: "#e879a7", background: "#fff7fb", surface: "#ffffff", text: "#351527" },
      ink: { primary: "#31365f", accent: "#e9b949", background: "#f4f4fa", surface: "#ffffff", text: "#20233d" },
      moss: { primary: "#3f6212", accent: "#ea6b3e", background: "#f7faef", surface: "#ffffff", text: "#283314" }
    };
    dispatch({ type: "theme/update", patch: palettes[name] }); showToast("配色已应用");
  }

  function switchMobileView(view) {
    document.querySelectorAll("[data-mobile-view]").forEach(function (button) { button.classList.toggle("active", button.dataset.mobileView === view); });
    syncResponsivePanes();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function syncResponsivePanes() {
    var isMobile = window.matchMedia("(max-width: 900px)").matches;
    var active = document.querySelector("[data-mobile-view].active");
    var view = active ? active.dataset.mobileView : "edit";
    document.getElementById("editorPane").hidden = isMobile && view !== "edit";
    document.getElementById("previewPane").hidden = isMobile && view !== "preview";
  }

  window.addEventListener("resize", syncResponsivePanes);
  syncResponsivePanes(); render(); queueSave();
})(window.MenuCore, window.MenuTemplates);
