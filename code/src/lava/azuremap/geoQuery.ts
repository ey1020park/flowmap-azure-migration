// 📁 src/lava/azuremap/geoQuery.ts
// ✅ Azure Maps API를 사용한 geocoding 처리 및 큐 기반 실행

import { ILocation } from "./converter";
import { Func, StringMap } from "../type";
import { AZURE_MAPS_KEY } from "./config";


const subscriptionKey = AZURE_MAPS_KEY;
const apiVersion = "1.0";

export class GeoQuery {
  private _addresses: string[];
  private _cancelled = false;
  private _results: StringMap<ILocation> = {};

  constructor(addresses: string[]) {
    this._addresses = [...new Set(addresses.filter(Boolean))];
  }

  public cancel() {
    this._cancelled = true;
  }

  public run(callback: Func<ILocation, void>) {
    const next = async () => {
      if (this._cancelled || this._addresses.length === 0) return;

      const addr = this._addresses.shift();
      if (this._results[addr]) {
        callback(this._results[addr]);
        next();
        return;
      }

      const loc = await this._fetch(addr);
      if (loc) this._results[addr] = loc;
      callback(loc);
      next();
    };
    next();
  }

  private async _fetch(address: string): Promise<ILocation | null> {
    const url = `https://atlas.microsoft.com/search/address/json?api-version=${apiVersion}&subscription-key=${subscriptionKey}&query=${encodeURIComponent(address)}`;

    try {
      const res = await fetch(url);
      const json = await res.json();
      const pos = json && json.results && json.results[0] && json.results[0].position;

      if (pos) {
        return {
          address,
          latitude: pos.lat,
          longitude: pos.lon
        };
      }
    } catch (e) {
      console.error("Geocode failed for:", address, e);
    }
    return null;
  }
}
