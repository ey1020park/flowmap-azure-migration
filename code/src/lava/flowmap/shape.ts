// 📁 src/lava/flowmap/shape.ts - Azure Maps 기반으로 리팩토링된 shape.ts

import { ILocation, IBound, Converter } from '../googlemap';
import { Func, StringMap } from '../type';
import { Key, IPathPoint, IPoint, ILayout, IPath, layout } from './algo';
import { extent } from 'd3-array';
import { arc } from './arc';
import { ISelex } from '../d3';

import { $state } from './app';
import {objectValues} from '../../utils/values'

const map20 = new Converter(20);

function pointConverter(level: number) {
  const zoom = $state.mapctl.map.getZoom();
  if (zoom === level) return null;
  const factor = map20.factor(zoom);
  return (input: IPathPoint, output: number[]) => {
    output[0] = input[0] * factor;
    output[1] = input[1] * factor;
  };
}

class LinePath implements IPath {
  id: Key;
  leafs: Key[];
  private _width: number;
  private _path: string;
  minLatitude: number;
  maxLatitude: number;

  constructor(path: string, key: number, public weight: number) {
    this.id = key;
    this.leafs = [key];
    this._width = weight;
    this._path = path;
  }

  d(): string {
    return this._path;
  }

  width(scale?: Func<number, number>): number {
    if (scale) {
      this._width = scale(this.weight);
    }
    return this._width;
  }
}

class helper {
  public static initPaths(root: ISelex, shape: IShape) {
    root.selectAll('*').remove();
    root.selectAll('.base').data(shape.paths()).enter().append('path');
    root.selectAll('path').att.class('base flow').att.d(p => p.d())
      .att.stroke_linecap('round').att.fill('none');
  }

  public static line(src: ILocation, tlocs: ILocation[], trows: number[], weis: number[]) {
    const all = tlocs.concat(src);
    const bound = map20.points(all);
    const spnt = bound.points.pop();
    const pre = 'M ' + Math.round(spnt.x) + ' ' + Math.round(spnt.y);
    const paths: StringMap<LinePath> = {};
    for (let i = 0; i < bound.points.length; i++) {
      const tpnt = bound.points[i];
      const trow = trows[i];
      const str = `${pre} L ${Math.round(tpnt.x)} ${Math.round(tpnt.y)}`;
      paths[trow] = new LinePath(str, trow, weis[i]);
    }
    return { paths, bound };
  }

  public static arc(src: ILocation, tlocs: ILocation[], trows: number[], weis: number[]) {
    const slon = src.longitude;
    const slat = src.latitude;
    const scoord = { x: 0, y: slat }, tcoord = { x: 0, y: 0 };
    const all = tlocs.concat(src);
    const bound = $state.mapctl.bound(all);
    const anchor = bound.anchor;
    anchor.latitude = slat;
    const alon = anchor.longitude;
    let bias = map20.x(slon) - map20.x(alon);
    if (Math.abs(alon - slon) > 180) {
      if (alon > slon) {
        bias = map20.x(slon + 360 - alon - 180);
      } else {
        bias = 0 - map20.x(alon + 360 - slon - 180);
      }
    }
    const paths: StringMap<LinePath> = {};
    let minlat = Number.POSITIVE_INFINITY;
    let maxlat = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < tlocs.length; i++) {
      const t = tlocs[i];
      const tlon = t.longitude;
      const trow = trows[i];
      tcoord.y = t.latitude;
      if (Math.abs(tlon - slon) < 180) {
        tcoord.x = tlon - slon;
      } else {
        tcoord.x = tlon < slon ? 360 - slon + tlon : tlon - slon - 360;
      }
      const cnt = Math.max(Math.round(Math.abs(tcoord.x / 4)), 10);
      const coords = arc(scoord, tcoord, cnt);
      const sx = map20.x(0);
      const sy = map20.y(scoord.y);
      let str = 'M ' + Math.round(bias) + ' 0';
      let miny = Number.POSITIVE_INFINITY, maxy = Number.NEGATIVE_INFINITY;
      for (const [px, py] of coords) {
        miny = Math.min(miny, py);
        maxy = Math.max(maxy, py);
        const dx = Math.round(map20.x(px) - sx + bias);
        const dy = Math.round(map20.y(py) - sy);
        str += ' L ' + dx + ' ' + dy;
      }
      const apath = new LinePath(str, trow, weis[i]);
      apath.minLatitude = miny;
      apath.maxLatitude = maxy;
      paths[trow] = apath;
      minlat = Math.min(minlat, miny);
      maxlat = Math.max(maxlat, maxy);
    }
    bound.margin.north = maxlat - slat;
    bound.margin.south = slat - minlat;
    return { paths, bound };
  }
}

export interface IShape {
  rewidth(): void;
  calc(weight: (row: number) => number): number[];
  transform(pzoom: number): void;
  bound: IBound;
  source: ILocation;
  paths(): IPath[];
}

export function build(
  type: 'straight' | 'flow' | 'arc',
  d3: ISelex,
  src: ILocation,
  tars: ILocation[],
  trows: number[],
  weis: number[]
): IShape {
  if (type === 'flow') {
    return new FlowShape(d3, src, tars, trows, weis);
  } else if (type === 'arc') {
    const arcData = helper.arc(src, tars, trows, weis);
    return new LineShape(d3, src, arcData.paths, arcData.bound);
  } else {
    const line = helper.line(src, tars, trows, weis);
    return new LineShape(d3, src, line.paths, line.bound);
  }
}

class FlowShape implements IShape {
  public readonly d3: ISelex;
  public readonly bound: IBound;
  public readonly source: ILocation;
  private _layout: ILayout;

  constructor(d3: ISelex, src: ILocation, tars: ILocation[], trows: number[], weis?: number[]) {
    this.source = src;
    const area = map20.points([src, ...tars]);
    const points = area.points;
    const sourcePoint = points.shift() as IPoint;
    sourcePoint.key = $state.config.source(trows[0]);
    for (let i = 0; i < points.length; i++) {
      (points[i] as IPoint).key = trows[i];
    }
    this._layout = layout(sourcePoint, points, weis);
    helper.initPaths(d3, this);
    this.d3 = d3;
    this.bound = area;
  }

  paths(): IPath[] {
    return this._layout.paths();
  }

  calc(weight: (row: number) => number): number[] {
    weight && this._layout.build(weight);
    return extent(this._layout.paths().map(p => p.weight));
  }

  rewidth() {
    const conv = pointConverter(null);
    this.d3.selectAll<IPath>('path')
      .att.stroke_width(p => p.width($state.width))
      .att.d(p => p.d(conv));
  }

  transform(pzoom: number) {
    const conv = pointConverter(pzoom);
    conv && this.d3.selectAll<IPath>('.flow').att.d(p => p.d(conv));
  }
}

class LineShape implements IShape {
  public readonly d3: ISelex;
  public readonly bound: IBound;
  public readonly source: ILocation;

  private _row2Path: StringMap<LinePath>;

  constructor(d3: ISelex, src: ILocation, row2Path: StringMap<LinePath>, bound: IBound) {
    this.d3 = d3;
    this.source = src;
    this._row2Path = row2Path;
    this.bound = bound;
    helper.initPaths(d3, this);
  }

  calc(weight: (row: number) => number): number[] {
    if (weight) {
      for (const r in this._row2Path) {
        this._row2Path[r].weight = weight(+r);
      }
    }
    return extent(objectValues(this._row2Path).map(p => p.weight));
  }

  rewidth() {
    const factor = map20.factor($state.mapctl.map.getZoom());
    const width = (v: number) => $state.width(v) / factor;
    this.d3.att.scale(factor);
    this.d3.selectAll<IPath>('path').att.stroke_width(p => p.width(width));
  }

  transform(_: number) {
    this.rewidth();
  }

  paths(): IPath[] {
    return objectValues(this._row2Path);
  }
}
