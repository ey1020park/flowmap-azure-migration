// 📁 src/lava/googlemap/controller.ts
// ✅ 기존 bingmap/controller.ts 구조를 최대한 유지하며 Google Maps 기반으로 리팩토링한 버전입니다.

import { ILocation, IBound } from './converter';
import { anchor, anchorPixel, area, bound, fitOptions } from './converter';
import { keys, IPoint } from '../type';
import { ISelex, selex } from '../d3';

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

export function pixel(map: google.maps.Map, loc: ILocation): IPoint {
    const scale = Math.pow(2, map.getZoom());
    const projection = map.getProjection();
    const latLng = new google.maps.LatLng(loc.latitude, loc.longitude);
    const worldCoordinate = projection.fromLatLngToPoint(latLng);
    return {
        x: worldCoordinate.x * scale,
        y: worldCoordinate.y * scale
    };
}

export function coordinate(map: google.maps.Map, point: IPoint): ILocation {
    const scale = Math.pow(2, map.getZoom());
    const projection = map.getProjection();
    const worldPoint = new google.maps.Point(point.x / scale, point.y / scale);
    const latLng = projection.fromPointToLatLng(worldPoint);
    return { latitude: latLng.lat(), longitude: latLng.lng() };
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
    private _map: google.maps.Map;
    private _fmt: IMapFormat;
    private _svg: ISelex;
    private _svgroot: ISelex;
    private _canvas: ISelex;
    private _listener: IListener[] = [];
    private _zoom: number = 5;

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
        const center = { lat: 37.5, lng: 127.0 };
        this._map = new google.maps.Map(this._div, {
            center,
            zoom: this._zoom,
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            disableDefaultUI: true
        });

        this._map.addListener('zoom_changed', () => this._viewChange(false));
        this._map.addListener('idle', () => this._viewChange(true));
        google.maps.event.addListenerOnce(this._map, 'tilesloaded', () => this._resize());
    }

    public get map() { return this._map; }
    public get svg() { return this._svgroot; }
    public get canvas() { return this._canvas; }
    public get format() { return this._fmt; }

    public setCamera(center: ILocation, zoom: number): void {
        this._map.setCenter({ lat: center.latitude, lng: center.longitude });
        this._map.setZoom(zoom);
    }

    public pixel(loc: ILocation | IBound): IPoint {
        if ((loc as IBound).anchor) {
            return anchorPixel(this._map as any, loc as any);
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
    
        const [lng, lat] = config.center;
        this.setCamera({ latitude: lat, longitude: lng }, config.zoom);
    }

    private _viewChange(end = false) {
        const zoom = this._map.getZoom();
        for (const l of this._listener) {
            l.transform?.(this, this._zoom, end);
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
            l.resize?.(this);
        }
    }
    public setCenterZoom(center: [number, number], zoom: number): void {
        this.setCamera({ latitude: center[1], longitude: center[0] }, zoom);
    }
    // controller.ts
    public get container(): HTMLDivElement {
        return this._div;
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
