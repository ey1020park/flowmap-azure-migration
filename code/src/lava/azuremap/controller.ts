// 📁 src/lava/azuremap/controller.ts
// ✅ 기존 bingmap/controller.ts 구조를 최대한 유지하며 Azure Maps 기반으로 재작성한 버전입니다.

import * as atlas from 'azure-maps-control';
import { AuthenticationType } from 'azure-maps-control';
import { ILocation, IBound } from './converter';
import { anchor, anchorPixel, area, bound, fitOptions } from './converter';
import { keys, IPoint } from '../type';
import { ISelex, selex } from '../d3';
import { AZURE_MAPS_KEY } from "./config";


export interface IMapElement {
    forest: boolean,
    label: boolean,
    road: 'color' | 'gray' | 'gray_label' | 'hidden',
    icon: boolean,
    area: boolean,
    building: boolean,
    city: boolean,
    scale: boolean
}

export interface IMapControl {
    type: 'hidden' | 'road' | 'grayscale',
    lang: string,
    pan: boolean,
    zoom: boolean
}

export interface IMapFormat extends IMapControl, IMapElement { }

export function pixel(map: atlas.Map, loc: ILocation): IPoint {
    const pos = new atlas.data.Position(loc.longitude, loc.latitude);
    const px = map.positionsToPixels([pos])[0];
    return { x: px[0], y: px[1] };
}

export function coordinate(map: atlas.Map, point: IPoint): ILocation {
    const position = map.pixelsToPositions([[point.x, point.y]])[0];
    return { latitude: position[1], longitude: position[0] };
}

export class MapFormat implements IMapFormat {
    type: 'hidden' | 'road' | 'grayscale' = 'road';
    lang = 'en-US';
    pan = true;
    zoom = true;
    forest = true;
    label = true;
    road: 'color' | 'gray' | 'gray_label' | 'hidden' = 'color';
    icon = true;
    area = false;
    building = false;
    city = true;
    scale = false;

    public static build(...fmts: any[]): MapFormat {
        const ret = new MapFormat();
        for (const f of fmts.filter(v => v)) {
            for (const key in ret) {
                if (key in f) ret[key] = f[key];
            }
        }
        return ret;
    }
}

export interface IListener {
    transform?(ctl: Controller, zoom: number, end?: boolean): void;
    resize?(ctl: Controller): void;
}

export class Controller {
    private _div: HTMLDivElement;
    private _map: atlas.Map;
    private _fmt: IMapFormat;
    private _svg: ISelex;
    private _svgroot: ISelex;
    private _canvas: ISelex;
    private _listener: IListener[] = [];
    private _zoom: number;

    constructor(id: string) {
        this._div = selex(id).node();
        this._fmt = new MapFormat();

        const config = (el: ISelex) => el.att.tabIndex(-1)
            .sty.pointer_events('none')
            .sty.position('absolute')
            .sty.visibility('inherit')
            .sty.user_select('none');

        this._canvas = config(selex(this._div).append('canvas'));
        this._svg = config(selex(this._div).append('svg'));
        this._svgroot = this._svg.append('g').att.id('root');

        this._initMap();
    }

    private _initMap() {
        this._map = new atlas.Map(this._div, {
            view: 'Auto',
            center: [127.0, 37.5],
            zoom: 5,
            authOptions: {
                authType: AuthenticationType.subscriptionKey,
                subscriptionKey: AZURE_MAPS_KEY
            }
        });

        (this._map.events as any).add('viewchange', () => this._viewChange(false));
        (this._map.events as any).add('viewchangeend', () => this._viewChange(true));
        this._map.events.add('ready', () => this._resize());
    }

    public get map() { return this._map; }
    public get svg() { return this._svgroot; }
    public get canvas() { return this._canvas; }
    public get format() { return this._fmt; }

    public setCamera(center: ILocation, zoom: number): void {
        this._map.setCamera({
          center: [center.longitude, center.latitude],
          zoom: zoom
        });
    }

    public setCenterZoom(center: atlas.data.Position, zoom: number) {
        this._map.setCamera({ center, zoom });
    }

    public pixel(loc: ILocation | IBound): IPoint {
        if ((loc as IBound).anchor) {
            return anchorPixel(this._map, loc as any);
        } else {
            return pixel(this._map, loc as any);
        }
    }

    public location(p: IPoint): ILocation {
        return coordinate(this._map, p);
    }

    public anchor(locs: ILocation[]) { return anchor(locs); }
    public area(locs: ILocation[], level = 20) { return area(locs, level); }
    public bound(locs: ILocation[]) { return bound(locs); }

    public add(listener: IListener) {
        this._listener.push(listener);
        return this;
    }

    public fitView(bounds: IBound[], backupCenter?: ILocation) {
        const width = this._div.clientWidth;
        const height = this._div.clientHeight;
        const config = fitOptions(bounds, { width, height });
        this.setCenterZoom(config.center, config.zoom);
    }

    private _viewChange(end = false) {
        const zoom = this._map.getCamera().zoom;
        for (const l of this._listener) {
            l.transform(this, this._zoom, end);
        }
        this._zoom = zoom;
    }

    private _resize() {
        const w = this._div.clientWidth;
        const h = this._div.clientHeight;
        this._svg.att.width('100%').att.height('100%');
        this._canvas.att.size(w, h);
        this._svgroot.att.translate(w / 2, h / 2);
        for (const l of this._listener) {
            l.resize(this);
        }
    }
}

// 📌 controller.ts 맨 아래에 추가
export function defaultZoom(width: number, height: number): number {
    const min = Math.min(width, height);
    for (let level = 1; level <= 20; level++) {
        if (256 * Math.pow(2, level) > min) {
            return level;
        }
    }
    return 20;
}