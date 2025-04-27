// 📁 src/lava/googlemap/geoQuery.ts
// ✅ Google Maps Geocoding API를 사용한 지오코딩 처리 및 큐 기반 실행

import { ILocation } from "./converter";
import { Func, StringMap } from "../type";
import { GOOGLE_MAPS_API_KEY } from "../../config";

const apiVersion = "1.0"; // Google Maps에서는 필요 없음. 보존만.

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
      if (addr && this._results[addr]) {
        callback(this._results[addr]);
        next();
        return;
      }

      if (!addr) return;

      const loc = await this._fetch(addr);
      if (loc) {
        this._results[addr] = loc;
        callback(loc);
      }
      next();
    };
    next();
  }

  private async _fetch(address: string): Promise<ILocation | null> {
    const apiKey = (window as any).GOOGLE_MAPS_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;

    try {
        const res = await fetch(url);
        const json = await res.json();

        console.log("📍 [Geocode Request]", address);
        console.log("📍 [Geocode Result]", JSON.stringify(json));

        const result = json.results[0];
        if (result && result.geometry && result.geometry.location) {
            return {
                address,
                latitude: result.geometry.location.lat,
                longitude: result.geometry.location.lng
            };
        }
    } catch (e) {
        console.error("❌ Geocode failed:", address, e);
    }
    return null;
  }
}
