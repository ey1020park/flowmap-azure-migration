// 📁 src/lava/azuremap/converter.ts
// ✅ 기존 bingmap/converter.ts를 기반으로 Azure Maps 대응용으로 리팩토링
import * as atlas from 'azure-maps-control';
import { defaultZoom } from './controller';
import { ISize, IPoint, Func, StringMap, clamp } from '../type';
import { pixel } from './controller'; // converter.ts 맨 위에서 pixel()을 불러옵니다

export function anchorPixel(map: atlas.Map, bound: IBound): IPoint {
    return pixel(map, bound.anchor); // 기본 anchor 위치만 픽셀로 변환 (wrap-around 없음)
}
export interface ILocation {
    latitude: number;
    longitude: number;
    type?: string;
    name?: string;
    address?: string;
}

export interface IArea {
    points: IPoint[];
    anchor: ILocation;
    margin: { south: number, north: number, east: number, west: number };
    offsets: number[];
    scale(zoom: number): number;
}

export interface IBound {
    anchor: ILocation;
    margin: { south: number, north: number, east: number, west: number };
    offsets?: number[];
}

export function bound(data: ILocation[]): IBound {
    const anch = anchor(data);
    if (!anch) return null;
    const { longitude: alon, latitude: alat, positive } = anch;
    let west = 0, east = 0, south = 0, north = 0;
    const offsets: number[] = [];

    for (let i = 0; i < data.length; i++) {
        const d = data[i];
        if (!d) continue;
        const long = d.longitude, lati = d.latitude;
        if (lati > alat) north = Math.max(north, lati - alat);
        else south = Math.max(south, alat - lati);

        if (positive) {
            if (long > alon) east = Math.max(east, long - alon);
            else {
                if (alon - long > long + 360 - alon) {
                    east = Math.max(long + 360 - alon, east);
                    offsets[i] = 1;
                } else {
                    west = Math.max(alon - long, west);
                }
            }
        } else {
            if (long < alon) west = Math.max(alon - long, west);
            else {
                if (alon - (long - 360) < long - alon) {
                    west = Math.max(alon - (long - 360), west);
                    offsets[i] = -1;
                } else {
                    east = Math.max(long - alon, east);
                }
            }
        }
    }

    return {
        anchor: { longitude: alon, latitude: alat },
        margin: { east, west, south, north },
        offsets
    };
}

export function fitOptions(bounds: IBound[], view: ISize): { center: [number, number]; zoom: number } {
    bounds = (bounds || []).filter(Boolean);
    if (bounds.length === 0) {
        return {
            zoom: defaultZoom(view.width, view.height),
            center: [0, 0]
        };
    }

    let n = Math.max(...bounds.map(a => a.anchor.latitude + a.margin.north));
    let s = Math.min(...bounds.map(a => a.anchor.latitude - a.margin.south));
    let w = Math.min(...bounds.map(a => a.anchor.longitude - a.margin.west));
    let e = Math.max(...bounds.map(a => a.anchor.longitude + a.margin.east));

    s = clamp(s, -88, 88);
    n = clamp(n, -88, 88);

    const center: [number, number] = [(w + e) / 2, (s + n) / 2];
    let height = Math.abs(helper.lat2y(n, 20) - helper.lat2y(s, 20));
    let width = helper.lon2x(e - w, 20);
    

    let level = 20;
    while (level > 1 && (width > view.width || height > view.height)) {
        width /= 2;
        height /= 2;
        level--;
    }

    return { zoom: level, center };
}

export function anchor(data: ILocation[]): ILocation & { positive: boolean } {
    if (!data || data.length === 0) return null;
    let pcnt = 0, ncnt = 0, psum = 0, nsum = 0, latsum = 0;

    for (const d of data) {
        if (!d) continue;
        const { longitude: long, latitude: lati } = d;
        latsum += lati;
        if (long > 0) { pcnt++; psum += long; }
        else { ncnt++; nsum += long; }
    }

    const positive = psum + nsum > 0;
    return {
        longitude: positive ? psum / pcnt : nsum / ncnt,
        latitude: latsum / data.length,
        positive
    };
}

export function area(data: ILocation[], level = 20): IArea {
    const b = bound(data) as any as IArea;
    if (!b) return null;

    const { longitude: alon, latitude: alat } = b.anchor;
    const offsets = b.offsets;
    const period = helper.lon2x(180, level);
    const ax = helper.lon2x(alon, level);
    const ay = helper.lat2y(alat, level);
    const points: IPoint[] = [];

    for (let i = 0; i < data.length; i++) {
        const d = data[i];
        if (!d) {
            points.push(null);
            continue;
        }
        const x = Math.round(helper.lon2x(d.longitude, level) - ax);
        const y = Math.round(helper.lat2y(d.latitude, level) - ay);
        points.push({ x: x + (offsets[i] || 0) * period, y });
    }

    b.points = points;
    b.scale = z => Math.pow(2, z - level);
    return b;
}

export class Converter {
    constructor(private _level: number) {}

    public factor(zoom: number): number {
        return Math.pow(2, zoom - this._level);
    }

    public line(data: ILocation[]): IArea {
        const ret = this.points(data);
        const half = helper.lon2x(0, this._level);
        let prev: IPoint = null;

        for (const p of ret.points) {
            if (!p) continue;
            if (!prev) { prev = p; continue; }
            const delta = prev.x - p.x;
            if (Math.abs(delta) > half) {
                p.x += (delta > 0 ? 2 : -2) * half;
            }
            prev = p;
        }

        return ret;
    }

    public points(data: ILocation[]): IArea {
        return area(data, this._level);
    }

    public x(lng: number): number {
        return helper.lon2x(lng, this._level);
    }

    public y(lat: number): number {
        return helper.lat2y(lat, this._level);
    }
}

namespace helper {
    let _mapSizeCache = [0, 0];
    function _map2Screen(v: number, level: number): number {
        const size = mapSize(level);
        return Math.min(v * size + 0.5, size - 1);
    }

    export function mapSize(level: number): number {
        if (level === _mapSizeCache[0]) return _mapSizeCache[1];
        const size = 256 * Math.pow(2, level);
        _mapSizeCache = [level, size];
        return size;
    }

    export function lat2y(lat: number, level: number): number {
        lat = clamp(lat, -85.05112878, 85.05112878);
        const sin = Math.sin(lat * Math.PI / 180);
        const y = 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
        return _map2Screen(y, level);
    }

    export function lon2x(lon: number, level: number): number {
        lon = clamp(lon, -180, 180);
        return _map2Screen((lon + 180) / 360, level);
    }

    export function loc(pixelX: number, pixelY: number, level: number): ILocation {
        const size = mapSize(level); // ✅ 함수 호출 → 변수명은 충돌 안나게 변경
        const x = Math.min(pixelX, size - 1) / size - 0.5;
        const y = 0.5 - Math.min(pixelY, size - 1) / size;
        const latitude = 90 - 360 * Math.atan(Math.exp(-y * 2 * Math.PI)) / Math.PI;
        const longitude = 360 * x;
        return { latitude, longitude };
    }
}
