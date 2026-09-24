export const GALAXY_STORE = {
  "_help": "Room, camera and lights. Units are meters. Center is 0,0,0. Back wall = -Z, front counter = +Z, left wall = -X. Replace this file and refresh to update the shop.",
  "meta": {
    "name": "Mobile Galaxy F-69",
    "brand": "LOGIN Smart Technology",
    "shopNo": "F-69"
  },
  "room": {
    "width": 5.6,
    "depth": 6.4,
    "height": 2.88,
    "wallColor": "#c9a36c",
    "floorColor": "#f3f3f3",
    "groutColor": "#d0d0d0",
    "ceilingRed": "#c62828",
    "ceilingWhite": "#f4f4f4",
    "ceilingTile": 0.7
  },
  "camera": {
    "fov": 54,
    "position": [0, 1.62, 2.05],
    "target": [0, 1.08, -1.45],
    "minDistance": 1.2,
    "maxDistance": 9
  },
  "presets": {
    "interior": {
      "label": "Andar",
      "position": [0, 1.62, 2.05],
      "target": [0, 1.08, -1.45]
    },
    "counter": {
      "label": "Counter",
      "position": [0, 1.52, 5.35],
      "target": [-0.32, 1.02, 2.55]
    },
    "wide": {
      "label": "Wide",
      "position": [0.05, 1.56, 2.05],
      "target": [0.1, 1.18, -1.7]
    }
  },
  "lights": {
    "ambient": 0.24,
    "hemisphereSky": "#fff6ea",
    "hemisphereGround": "#8a6a3e",
    "hemisphere": 0.36,
    "sun": {
      "color": "#fff4e0",
      "intensity": 1.3,
      "position": [1.4, 5.2, 1.8]
    },
    "points": [
      { "position": [-1.4, 2.72, -1.4], "intensity": 6, "color": "#fff8ee" },
      { "position": [1.4, 2.72, -1.4], "intensity": 6, "color": "#fff8ee" },
      { "position": [0, 2.72, 1.5], "intensity": 7, "color": "#fff4e4" },
      { "position": [0, 2.4, 2.7], "intensity": 8, "color": "#fff1c8" },
      { "position": [2.1, 2.55, 0.2], "intensity": 5.5, "color": "#fff6ea" }
    ]
  }
};

export const GALAXY_FURNITURE = {
  "_help": "Furniture positions in meters. Edit and refresh. You can add more chairs or move the desk without changing code.",
  "backCabinet": {
    "position": [0.05, 0, -3.05],
    "width": 5.05,
    "height": 2.48,
    "depth": 0.32,
    "columns": 3,
    "shelfCount": 7
  },
  "goldShelves": {
    "position": [-2.62, 0, -2.35],
    "width": 0.72,
    "depth": 0.2,
    "heights": [1.12, 1.52, 1.92]
  },
  "desk": {
    "position": [1.42, 0, -1.28],
    "width": 1.18,
    "depth": 0.56,
    "height": 0.76
  },
  "chairs": [
    { "id": "staff", "position": [1.48, 0, -1.98], "rotation": 0.05 },
    { "id": "guest", "position": [0.28, 0, -0.38], "rotation": 2.24 }
  ],
  "counter": {
    "position": [-0.42, 0, 2.55],
    "rotation": 0,
    "width": 4.15,
    "depth": 0.74,
    "height": 0.96,
    "panels": 4
  },
  "banner": {
    "position": [0, 2.63, 3.38],
    "width": 5.08,
    "height": 1
  },
  "storefront": {
    "position": [0, 0, 3.2],
    "width": 5.6,
    "height": 3.08,
    "columnWidth": 0.38,
    "frameDepth": 0.2
  },
  "mainGate": {
    "position": [0, 1.13, 3.14],
    "width": 4.62,
    "height": 2.22,
    "depth": 0.075,
    "glassOpacity": 0.13
  },
  "sideCabinets": {
    "sides": ["left", "right"],
    "centerZ": 0.95,
    "length": 2.35,
    "height": 2.22,
    "depth": 0.24,
    "shelfCount": 6,
    "productsPerShelf": 9
  },
  "sign": {
    "text": "ماشاءالله",
    "position": [0.05, 2.62, -3.18]
  },
  "walkingPad": {
    "position": [2.15, 2.55, -3.02],
    "size": [0.42, 0.16, 0.28]
  },
  "stool": {
    "position": [2.28, 0, -1.32]
  },
  "ac": {
    "position": [0.05, 2.78, 0.15]
  },
  "ceilingFan": {
    "position": [1.15, 2.86, 1.35]
  },
  "wallFan": {
    "position": [2.68, 2.28, -1.15]
  }
};

export const GALAXY_PRODUCTS = {
  "_help": "Product catalog + shelf rows. To add a phone box: add a SKU in catalog, then put { sku, count } in a row. Refresh the page after upload.",
  "catalog": {
    "redmi-15c": { "label": "15C", "brand": "Redmi", "color": "#c62828", "w": 0.155, "h": 0.215, "d": 0.068 },
    "redmi-15": { "label": "15", "brand": "Redmi", "color": "#d32f2f", "w": 0.155, "h": 0.215, "d": 0.068 },
    "redmi-16": { "label": "16", "brand": "Redmi", "color": "#b71c1c", "w": 0.155, "h": 0.215, "d": 0.068 },
    "phone-red": { "label": "Note", "brand": "Redmi", "color": "#e53935", "w": 0.15, "h": 0.21, "d": 0.06 },
    "phone-green": { "label": "Hot", "brand": "Infinix", "color": "#43a047", "w": 0.155, "h": 0.215, "d": 0.068 },
    "phone-lime": { "label": "Spark", "brand": "Tecno", "color": "#7cb342", "w": 0.155, "h": 0.215, "d": 0.068 },
    "c71": { "label": "C71", "brand": "Tecno", "color": "#f4c430", "w": 0.155, "h": 0.215, "d": 0.068 },
    "c60x": { "label": "60x", "brand": "Infinix", "color": "#f9d449", "w": 0.155, "h": 0.215, "d": 0.068 },
    "c85": { "label": "C85", "brand": "Tecno", "color": "#f6c90e", "w": 0.155, "h": 0.215, "d": 0.068 },
    "case-purple": { "label": "Case", "brand": "Cover", "color": "#7e57c2", "w": 0.14, "h": 0.2, "d": 0.045 },
    "acc-white": { "label": "Kit", "brand": "LOGIN", "color": "#f5f5f5", "w": 0.13, "h": 0.13, "d": 0.055, "textColor": "#222222" },
    "acc-white-tall": { "label": "Adapter", "brand": "LOGIN", "color": "#eeeeee", "w": 0.12, "h": 0.16, "d": 0.05, "textColor": "#222222" },
    "case-black": { "label": "Case", "brand": "Cover", "color": "#1a1a1a", "w": 0.11, "h": 0.2, "d": 0.018, "kind": "hang" },
    "earbuds": { "label": "Buds", "brand": "Air", "color": "#111111", "w": 0.1, "h": 0.18, "d": 0.018, "kind": "hang" },
    "cable": { "label": "Cable", "brand": "Type-C", "color": "#1565c0", "w": 0.09, "h": 0.19, "d": 0.016, "kind": "hang" },
    "charger": { "label": "33W", "brand": "Charge", "color": "#263238", "w": 0.1, "h": 0.17, "d": 0.018, "kind": "hang" },
    "powerbank": { "label": "10K", "brand": "Power", "color": "#37474f", "w": 0.11, "h": 0.2, "d": 0.02, "kind": "hang" }
  },
  "backRows": [
    {
      "items": [
        { "sku": "redmi-15c", "count": 8 },
        { "sku": "redmi-15", "count": 8 },
        { "sku": "redmi-16", "count": 8 }
      ]
    },
    {
      "items": [
        { "sku": "acc-white", "count": 22 }
      ]
    },
    {
      "items": [
        { "sku": "phone-red", "count": 16 }
      ]
    },
    {
      "items": [
        { "sku": "phone-green", "count": 10 },
        { "sku": "phone-lime", "count": 10 }
      ]
    },
    {
      "items": [
        { "sku": "c71", "count": 8 },
        { "sku": "c60x", "count": 8 },
        { "sku": "c85", "count": 8 }
      ]
    },
    {
      "items": [
        { "sku": "case-purple", "count": 18 }
      ]
    },
    {
      "items": [
        { "sku": "acc-white-tall", "count": 20 }
      ]
    }
  ],
  "goldShelfBoxes": {
    "sku": "acc-white",
    "perShelf": 5
  },
  "hanging": {
    "origin": [-2.76, 0.88, -1.55],
    "cols": 6,
    "rows": 6,
    "colGap": 0.28,
    "rowGap": 0.24,
    "skus": [
      "case-black", "earbuds", "cable", "charger", "powerbank", "case-black",
      "cable", "earbuds", "case-black", "charger", "earbuds", "cable",
      "powerbank", "case-black", "cable", "earbuds", "charger", "powerbank",
      "case-black", "charger", "earbuds", "powerbank", "cable", "case-black",
      "earbuds", "cable", "charger", "case-black", "powerbank", "earbuds",
      "charger", "case-black", "cable", "earbuds", "case-black", "charger"
    ]
  },
  "counterPhones": [
    "#111111", "#2c2c2c", "#f2f2f2", "#1a237e", "#4a148c",
    "#b71c1c", "#e0e0e0", "#212121", "#0d47a1", "#37474f",
    "#fafafa", "#6d4c41", "#263238", "#cfd8dc", "#000000",
    "#eceff1"
  ]
};
