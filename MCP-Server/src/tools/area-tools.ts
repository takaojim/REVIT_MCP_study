import { Tool } from "@modelcontextprotocol/sdk/types.js";

export const areaTools: Tool[] = [
    {
        name: "generate_area_boundaries",
        description: "在面積平面圖 (Area Plan) 中自動抓取牆體中心線，進行幾何投影壓平、平行線合併與端點微小間隙縫合後，批次建立 Revit 原生區域邊界線 (OST_AreaSchemeLines)。支援 5cm 庫板/無塵室隔間白名單與自訂最小厚度過濾。",
        inputSchema: {
            type: "object",
            properties: {
                viewId: { type: "number", description: "目標面積平面視圖 ID（必須是 AreaPlan）" },
                wallIds: {
                    type: "array",
                    items: { type: "number" },
                    description: "指定要抓取的牆體 ElementId 列表（選填，預設採集該視圖中所有實體牆）",
                },
                minThicknessMm: {
                    type: "number",
                    description: "牆體最小厚度閾值（mm，預設 45mm，可精確納入 5cm 庫板隔間；純 RC 案可設為 140mm）",
                },
                includePanels: {
                    type: "boolean",
                    description: "是否開啟庫板/Panel白名單優先保護（預設 true，名稱含庫板、Panel、隔間者不受厚度限制一律納入）",
                },
                includeRailings: {
                    type: "boolean",
                    description: "是否將陽台/露台/梯間欄杆 (OST_StairsRailing) 放樣中心線一併納入區域邊界線（預設 true）",
                },
                snapToSlabEdge: {
                    type: "boolean",
                    description: "依建築技術規則第1條第3款與第162條規定，陽台無外牆者以樓板外緣計算。是否自動尋找欄杆相鄰平行之樓板外緣線，以樓板外緣代替欄杆中心線（預設 true）",
                },
                viewTemplate: {
                    type: "string",
                    description: "目標視圖樣板名稱（預設 '計入容積'，自動律定套用）",
                },
                clearExisting: {
                    type: "boolean",
                    description: "是否清除視圖中既有的區域邊界線（預設 false）",
                },
                mergeToleranceMm: {
                    type: "number",
                    description: "平行重疊線合併容差（mm，預設 2.5mm）",
                },
                snapGapToleranceMm: {
                    type: "number",
                    description: "端點微小間隙自動吸附縫合閉合容差（mm，預設 5.0mm）",
                },
            },
            required: ["viewId"],
        },
    },
    {
        name: "place_areas_in_view",
        description: "在面積平面圖 (Area Plan) 中自動或依指定座標放置「面積 (Area)」標籤物件，支援自動推導房間中心種子點、預設命名與計入容積/面積法規參數設定。",
        inputSchema: {
            type: "object",
            properties: {
                viewId: { type: "number", description: "目標面積平面視圖 ID（必須是 AreaPlan）" },
                points: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            x: { type: "number", description: "X 座標 (mm)" },
                            y: { type: "number", description: "Y 座標 (mm)" },
                        },
                        required: ["x", "y"],
                    },
                    description: "欲放置面積的點位清單（選填，若未提供則自動取同樓層已放置之房間中心點作為種子）",
                },
                defaultName: {
                    type: "string",
                    description: "預設面積名稱（如：'居室'、'走廊'、'作業區'，預設 '居室'）",
                },
                defaultUsage: {
                    type: "string",
                    description: "預設用途名稱（如：'宿舍'、'作業廠房'）",
                },
                countInGross: {
                    type: "boolean",
                    description: "是否勾選 'C計入面積'（預設 true）",
                },
                countInFloorArea: {
                    type: "boolean",
                    description: "是否勾選 'C計入容積'（預設 true）",
                },
                useTopology: {
                    type: "boolean",
                    description: "是否開啟純幾何拓撲掃描（方法 B），自動計算邊界線封閉面幾何中心，100% 覆蓋無 Room 空間並繼承房間名稱（預設 true）",
                },
                viewTemplate: {
                    type: "string",
                    description: "目標視圖樣板名稱（預設 '計入容積'，自動律定套用）",
                },
                clearExisting: {
                    type: "boolean",
                    description: "是否清除視圖中既有的區域面積與標籤（預設 false，重新製作時設為 true）",
                },
            },
            required: ["viewId"],
        },
    },
    {
        name: "center_area_tags",
        description: "將面積平面圖中的所有區域標籤 (OST_AreaTags) 去除引線 (HasLeader=false) 並自動精準居中於空間範圍中心 (TagHeadPosition)。",
        inputSchema: {
            type: "object",
            properties: {
                viewId: { type: "number", description: "指定面積平面視圖 ID（選填，若未指定則處理專案中所有面積平面圖）" },
            },
        },
    },
];
