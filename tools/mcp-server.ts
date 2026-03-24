import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { execSync } from "child_process";

const ROOT = resolve(import.meta.dirname ?? ".", "..");
const DATA_DIR = resolve(ROOT, "public/data");

function readJson(filename: string) {
  return JSON.parse(readFileSync(resolve(DATA_DIR, filename), "utf-8"));
}

function writeJson(filename: string, data: unknown) {
  writeFileSync(resolve(DATA_DIR, filename), JSON.stringify(data, null, 2));
}

const server = new McpServer({
  name: "map2d",
  version: "1.0.0",
});

// --- Data tools (read/write JSON directly) ---

server.tool(
  "get_province_info",
  "Get info about a province by index or name",
  { query: z.string().describe("Province index (number) or name (string)") },
  async ({ query }) => {
    const data = readJson("provinces.json");
    const provinces = data.provinces;
    const match = provinces.find(
      (p: any) =>
        String(p.index) === query ||
        p.name.toLowerCase() === query.toLowerCase()
    );
    if (!match) return { content: [{ type: "text", text: `Province not found: ${query}` }] };

    const topology = readJson("topology.json");
    const center = topology.centers[String(match.index)];
    const neighbors = topology.adjacency[String(match.index)] || [];

    const nations = readJson("nations.json");
    const owner = nations.nations.find((n: any) => n.id === match.owner);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          ...match,
          center,
          neighbors,
          ownerName: owner?.name ?? "Unknown",
          ownerColor: owner?.color,
        }, null, 2),
      }],
    };
  }
);

server.tool(
  "list_nations",
  "List all nations with their colors and capitals",
  {},
  async () => {
    const data = readJson("nations.json");
    return {
      content: [{ type: "text", text: JSON.stringify(data.nations, null, 2) }],
    };
  }
);

server.tool(
  "list_provinces",
  "List all provinces with their owners",
  {},
  async () => {
    const data = readJson("provinces.json");
    const summary = data.provinces.map((p: any) => ({
      index: p.index,
      name: p.name,
      owner: p.owner,
      terrain: p.terrain,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
    };
  }
);

server.tool(
  "change_province_owner",
  "Transfer a province to a new nation",
  {
    provinceIndex: z.number().describe("Province index"),
    newOwner: z.string().describe("Nation ID of the new owner"),
  },
  async ({ provinceIndex, newOwner }) => {
    const data = readJson("provinces.json");
    const province = data.provinces.find((p: any) => p.index === provinceIndex);
    if (!province) {
      return { content: [{ type: "text", text: `Province ${provinceIndex} not found` }] };
    }

    const nations = readJson("nations.json");
    const nation = nations.nations.find((n: any) => n.id === newOwner);
    if (!nation) {
      return { content: [{ type: "text", text: `Nation ${newOwner} not found` }] };
    }

    const oldOwner = province.owner;
    province.owner = newOwner;
    writeJson("provinces.json", data);

    return {
      content: [{
        type: "text",
        text: `Transferred ${province.name} (${provinceIndex}) from ${oldOwner} to ${newOwner} (${nation.name})`,
      }],
    };
  }
);

server.tool(
  "query_topology",
  "Get province centers and/or adjacency data",
  {
    provinceIndex: z.number().optional().describe("Specific province index, or omit for all"),
  },
  async ({ provinceIndex }) => {
    const topology = readJson("topology.json");

    if (provinceIndex !== undefined) {
      const key = String(provinceIndex);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            center: topology.centers[key],
            neighbors: topology.adjacency[key],
          }, null, 2),
        }],
      };
    }

    return {
      content: [{
        type: "text",
        text: `${Object.keys(topology.centers).length} provinces, ${Object.values(topology.adjacency).reduce((a: number, b: any) => a + b.length, 0) / 2} edges`,
      }],
    };
  }
);

server.tool(
  "regenerate_textures",
  "Regenerate all support textures (id-map, heightmap, normalmap, borders, topology) from terrain_map.png",
  {},
  async () => {
    try {
      const output = execSync("python tools/generate-test-textures.py", {
        cwd: ROOT,
        encoding: "utf-8",
        timeout: 120000,
      });
      return { content: [{ type: "text", text: output }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}\n${e.stderr || ""}` }] };
    }
  }
);

server.tool(
  "add_province",
  "Add a new province to the game data",
  {
    name: z.string().describe("Province name"),
    terrain: z.string().describe("Terrain type (Plains, Hills, Mountains, Forest, Farmland, Coastland)"),
    owner: z.string().describe("Nation ID of the owner"),
    population: z.number().describe("Population"),
  },
  async ({ name, terrain, owner, population }) => {
    const data = readJson("provinces.json");
    const maxIndex = Math.max(...data.provinces.map((p: any) => p.index));
    const newIndex = maxIndex + 1;
    // Color encoded from index
    const r = (newIndex >> 16) & 0xff;
    const g = (newIndex >> 8) & 0xff;
    const b = newIndex & 0xff;

    const province = { index: newIndex, color: [r, g, b], name, terrain, owner, population };
    data.provinces.push(province);
    writeJson("provinces.json", data);

    return {
      content: [{
        type: "text",
        text: `Added province ${name} (index ${newIndex}, color [${r},${g},${b}]). Run regenerate_textures to update the map.`,
      }],
    };
  }
);

server.tool(
  "add_nation",
  "Add a new nation to the game data",
  {
    id: z.string().describe("Nation ID (lowercase, no spaces)"),
    name: z.string().describe("Display name"),
    color: z.array(z.number()).length(3).describe("RGB color [r, g, b] 0-255"),
    capital: z.number().describe("Capital province index"),
  },
  async ({ id, name, color, capital }) => {
    const data = readJson("nations.json");
    if (data.nations.find((n: any) => n.id === id)) {
      return { content: [{ type: "text", text: `Nation ${id} already exists` }] };
    }
    data.nations.push({ id, name, color, capital });
    writeJson("nations.json", data);

    return {
      content: [{ type: "text", text: `Added nation ${name} (${id}) with color [${color}]` }],
    };
  }
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
