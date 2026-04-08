import type { ProvinceData, NationData, TopologyData } from '../../types/index';
import { rgbToKey } from '../../utils/color';

export class GameState {
  provinces: Map<string, ProvinceData> = new Map();
  nations: Map<string, NationData> = new Map();
  provinceByIndex: Map<number, ProvinceData> = new Map();
  topology!: TopologyData;

  hoveredProvinceKey: string | null = null;
  selectedProvinceKey: string | null = null;

  async load(): Promise<void> {
    const [provData, nationData, topologyData] = await Promise.all([
      fetch('/data/provinces.json').then(r => r.json()),
      fetch('/data/nations.json').then(r => r.json()),
      fetch('/data/topology.json').then(r => r.json()),
    ]);

    this.topology = topologyData;

    for (const p of provData.provinces) {
      const key = rgbToKey(p.color[0], p.color[1], p.color[2]);
      const province: ProvinceData = {
        index: p.index,
        color: p.color,
        name: p.name,
        terrain: p.terrain,
        owner: p.owner,
        population: p.population,
      };
      this.provinces.set(key, province);
      this.provinceByIndex.set(p.index, province);
    }

    for (const n of nationData.nations) {
      this.nations.set(n.id, {
        id: n.id,
        name: n.name,
        color: n.color,
        capital: n.capital,
      });
    }
  }

  getProvince(key: string): ProvinceData | undefined {
    return this.provinces.get(key);
  }

  getNation(id: string): NationData | undefined {
    return this.nations.get(id);
  }

  transferProvince(provinceKey: string, newOwner: string): void {
    const province = this.provinces.get(provinceKey);
    if (province) {
      province.owner = newOwner;
    }
  }
}
