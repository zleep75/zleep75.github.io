(function attachMenuCore(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.MenuCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createMenuCore() {
  "use strict";

  const DEFAULT_THEME = Object.freeze({
    primary: "#8586ce",
    background: "#faf9f4",
    surface: "#d3b08c",
    text: "#303133",
    accent: "#cfaa83",
  });

  function cloneMenu(menu) {
    return JSON.parse(JSON.stringify(menu));
  }

  function makeId(prefix) {
    const random =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    return prefix + "-" + random;
  }

  function createDefaultMenu(idFactory) {
    const factory = typeof idFactory === "function" ? idFactory : () => makeId("id");
    const id = (label) => label + "-" + factory();
    return {
      stall: {
        name: "我的摊位",
        number: "",
        description: "",
        homeUrl: "",
        coverImage: "",
        qrImage: "",
        coverPosition: { x: 50, y: 50 },
      },
      categories: [
        { id: id("free"), name: "无料区", description: "", sortOrder: 0 },
        { id: id("paid"), name: "有偿交换区", description: "", sortOrder: 1 },
        { id: id("consign"), name: "寄售区", description: "", sortOrder: 2 },
      ],
      items: [],
      theme: { ...DEFAULT_THEME },
      meta: {
        version: 1,
        updatedAt: new Date().toISOString(),
      },
    };
  }

  function normalizeExternalUrl(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";
    if (trimmed.length > 2048) throw new Error("链接长度不能超过 2048 个字符");
    let url;
    try {
      url = new URL(trimmed);
    } catch {
      throw new Error("请输入完整链接，例如 https://example.com");
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("仅支持 http 或 https 链接");
    }
    return url.href;
  }

  function validateColor(value) {
    return /^#[0-9a-f]{6}$/i.test(String(value || ""));
  }

  function validateMenu(menu) {
    if (!menu || typeof menu !== "object") throw new Error("菜单数据无效");
    if (!menu.stall || !String(menu.stall.name || "").trim()) {
      throw new Error("请填写摊位名称");
    }
    if (!Array.isArray(menu.categories) || !Array.isArray(menu.items)) {
      throw new Error("菜单分类或制品数据无效");
    }
    const categoryIds = new Set();
    for (const category of menu.categories) {
      if (!category.id || categoryIds.has(category.id)) {
        throw new Error("分类标识必须唯一");
      }
      if (!String(category.name || "").trim()) throw new Error("分类名称不能为空");
      categoryIds.add(category.id);
    }
    const itemIds = new Set();
    for (const item of menu.items) {
      if (!item.id || itemIds.has(item.id)) throw new Error("制品标识必须唯一");
      if (!categoryIds.has(item.categoryId)) throw new Error("制品必须属于现有分类");
      if (!String(item.name || "").trim()) throw new Error("制品名称不能为空");
      normalizeExternalUrl(item.targetUrl);
      itemIds.add(item.id);
    }
    normalizeExternalUrl(menu.stall.homeUrl);
    const requiredColors = ["primary", "background", "surface", "text", "accent"];
    if (!menu.theme || requiredColors.some((key) => !validateColor(menu.theme[key]))) {
      throw new Error("主题颜色必须是六位十六进制值");
    }
    return menu;
  }

  function resequence(records) {
    return [...records]
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
      .map((record, index) => ({ ...record, sortOrder: index }));
  }

  function moveRecord(records, id, direction) {
    const ordered = resequence(records);
    const from = ordered.findIndex((record) => record.id === id);
    if (from < 0) return ordered;
    const to = Math.max(0, Math.min(ordered.length - 1, from + direction));
    if (to === from) return ordered;
    const [record] = ordered.splice(from, 1);
    ordered.splice(to, 0, record);
    return ordered.map((entry, index) => ({ ...entry, sortOrder: index }));
  }

  function menuReducer(menu, action) {
    const next = cloneMenu(menu);
    switch (action.type) {
      case "stall/update":
        next.stall = { ...next.stall, ...action.patch };
        break;
      case "theme/update":
        next.theme = { ...next.theme, ...action.patch };
        break;
      case "category/add":
        next.categories = resequence([...next.categories, cloneMenu(action.category)]);
        break;
      case "category/update":
        next.categories = next.categories.map((category) =>
          category.id === action.id ? { ...category, ...action.patch } : category,
        );
        break;
      case "category/move":
        next.categories = moveRecord(next.categories, action.id, action.direction);
        break;
      case "category/delete": {
        const affected = next.items.filter((item) => item.categoryId === action.id);
        if (affected.length && !action.moveItemsTo && !action.deleteItems) {
          throw new Error("请先移动或删除分类中的制品");
        }
        if (action.moveItemsTo) {
          if (!next.categories.some((category) => category.id === action.moveItemsTo)) {
            throw new Error("目标分类不存在");
          }
          next.items = next.items.map((item) =>
            item.categoryId === action.id
              ? { ...item, categoryId: action.moveItemsTo }
              : item,
          );
        } else if (action.deleteItems) {
          next.items = next.items.filter((item) => item.categoryId !== action.id);
        }
        next.categories = resequence(
          next.categories.filter((category) => category.id !== action.id),
        );
        break;
      }
      case "item/add":
        next.items.push(cloneMenu(action.item));
        break;
      case "item/update":
        next.items = next.items.map((item) =>
          item.id === action.id ? { ...item, ...action.patch } : item,
        );
        break;
      case "item/move": {
        const current = next.items.find((item) => item.id === action.id);
        if (!current) break;
        const group = moveRecord(
          next.items.filter((item) => item.categoryId === current.categoryId),
          action.id,
          action.direction,
        );
        const groupIds = new Set(group.map((item) => item.id));
        next.items = [
          ...next.items.filter((item) => !groupIds.has(item.id)),
          ...group,
        ];
        break;
      }
      case "item/delete":
        next.items = next.items.filter((item) => item.id !== action.id);
        break;
      case "item/restore":
        next.items = [...next.items, cloneMenu(action.item)];
        break;
      default:
        throw new Error("未知菜单操作：" + action.type);
    }
    next.meta = {
      ...(next.meta || { version: 1 }),
      updatedAt: new Date().toISOString(),
    };
    return next;
  }

  function visibleSections(menu) {
    const orderedCategories = resequence(menu.categories || []);
    return orderedCategories
      .map((category) => ({
        category: cloneMenu(category),
        items: resequence(
          (menu.items || []).filter((item) => item.categoryId === category.id),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }

  return {
    DEFAULT_THEME,
    cloneMenu,
    createDefaultMenu,
    makeId,
    menuReducer,
    normalizeExternalUrl,
    validateColor,
    validateMenu,
    visibleSections,
  };
});
