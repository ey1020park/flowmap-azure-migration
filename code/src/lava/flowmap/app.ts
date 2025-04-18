// 📁 src/lava/flowmap/app.ts (Azure Maps 대응 완성 버전)

import { Func, StringMap, Action, IRect, dict, keys, IPoint } from "../type";
import { selex } from "../d3";
import { Controller, MapFormat, ILocation } from '../azuremap';
import { Config } from "./config";
import { extent } from "d3-array";
import { scaleLinear, interpolateRgb, scaleSqrt, scaleIdentity } from "d3";
import { Legend } from "./legend";
import * as flows from './flow';
import * as pins from './pin';
import * as pies from './pie';
import * as popups from './popup';
import powerbi from "powerbi-visuals-api";
import {groupBy } from '../type';

import { Context } from "../../pbi"; // 필요 시 경로 확인
import { Format } from "../../flowmap/format"; 

export { Config } from './config';

type VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
 

export function tooltipForPath(
  ctx: Context<any, Format>,
  rows: number[]
): VisualTooltipDataItem[] {
  if (!ctx || !rows || rows.length === 0) return [];

  const popup = ctx.getConfig().popup; // ✅ 임시 우회 방법
  const tooltipItems: VisualTooltipDataItem[] = [];
 
  for (const row of rows) {
    tooltipItems.push({
      displayName: popup.origin(row),
      value: popup.description(row) && popup.description(row).toString() || ""

    });
  }

  return tooltipItems;
}
export function tooltipForPie(
  rows: number[],
  type: string,
  ctx: Context<any, Format>
): VisualTooltipDataItem[] {
  if (!ctx || !rows || rows.length === 0) return [];

  const popup = ctx.getConfig().popup;
  const tooltipItems: VisualTooltipDataItem[] = [];

  for (const row of rows) {
    tooltipItems.push({
      displayName: type,
      value: popup.description(row) && popup.description(row).toString() || ""

    });
  }

  return tooltipItems;
}
interface Issue {
  unlocate?: string;
  selflink?: string;
  negative?: string;
}

class State {
  public get border(): IRect {
    return {
      x: 0,
      y: 0,
      height: this.mapctl.map.getMapContainer().clientHeight,
      width: this.mapctl.map.getMapContainer().clientWidth
    };
  }
  config = null as Config<any>;
  issues = {} as StringMap<Issue>;
  geocode = {} as StringMap<ILocation>;
  color = null as Func<number, string>;
  width = null as Func<number, number>;
  mapctl = null as Controller;
  loc(addr: string) {
    if (addr in this.config.injections) return this.config.injections[addr];
    if (addr in this.geocode) return this.geocode[addr];
    return null;
  }
  reset(config: Config<any>) {
    this.config = config;
  }
  pixel(addr: string): IPoint {
    return this.mapctl.pixel(this.loc(addr));
  }
}

export const events = {
  doneGeocoding: null as Func<StringMap<ILocation>, void>,
  flow: flows.events,
  pin: pins.events,
  pie: pies.events,
  popup: popups.events
};

export let $state = new State();

let legend = null as Legend;
let rawGroups: number[][] = [];
let allValids: number[] = [];

export let key2rows = {} as StringMap<number[]>; // ✅ 여기에 추가


export function init(div: HTMLElement, mapFmt: MapFormat, initialPopups: string[], then: Func<Controller, void>) {
  popups.reset(initialPopups);
  const root = selex(div);
  root.append('div').att.id('view').sty.width('100%').sty.height('100%');
  root.append('div').att.id('mark');
  root.append('div').att.id('legend').sty.position('absolute').sty.top('0px').sty.left('0px');
  root.append('div').att.id('warn');
  legend = new Legend(root.select('#legend'));

  const ctl = $state.mapctl = new Controller('#view');
  ctl.svg.sty.cursor('default').sty.pointer_events('visiblePainted');
  ctl.add(flows.init(ctl.svg.append('g')));
  ctl.add(pins.init(ctl.svg.append('g')));
  ctl.add(pies.init(ctl.svg.append('g')));
  ctl.add({ resize: _ => legend.resize() });
  ctl.add(popups.init(root.select('#mark')));

  flows.events.hover = rows => {
    if (!rows) pies.hover(null);
    else {
      const srcs = dict(rows, r => $state.config.source(r));
      const tars = dict(rows, r => $state.config.target(r));
      pies.hover(keys(srcs, tars));
    }
  };
  then(ctl);
}

export function tryFitView() {
  const bounds = flows.bounds();
  if (bounds.length) {
    const source = flows.sources();
    let backup = null as ILocation;
    let area = -1;
    for (let i = 0; i < bounds.length; i++) {
      const { margin } = bounds[i];
      let a = margin.south - margin.east;
      a *= margin.north - margin.south;
      if (Math.abs(a) > area) {
        area = Math.abs(a);
        backup = source[i];
      }
    }
    $state.mapctl.fitView(bounds, backup);
  }
}

export function reset<F>(cfg: Config<F>, ctx: Context<any, F>, role: keyof F, then?: Action) {
  $state.reset(cfg);
  $state.issues = {};
  legend.resize();
  legend.clear();
  rawGroups = [];
  allValids = [];
  flows.clear();
  pins.clear();
  pies.clear();
  popups.clear();

  // ✅ 여기에서 key2rows 생성 (이제 cfg.context 대신, 매개변수 ctx 사용)
  const keyFn = ctx.key(role);
  key2rows = groupBy<number, number>(ctx.rows(), r => keyFn(r)); // ✅ 타입 완벽히 일치

  if (cfg.error) legend.info(cfg.error);
  else processGroups(cfg.groups, then);
}

function processGroups(groups: number[][], then?: Action) {
  for (const group of groups) addGroup(group);
  then && then();
  events.doneGeocoding && events.doneGeocoding($state.geocode);
}

function addGroup(group: number[]) {
  rawGroups.push(group);
  if ($state.config.advance.relocate) {
    pins.reset(rawGroups);
    return;
  }
  const source = $state.config.source(group[0]);
  if (!$state.loc(source)) {
    $state.issues[group[0]] = { unlocate: source };
    return;
  }
  const groupValid: number[] = [];
  const weight = $state.config.weight.conv;
  for (const row of group) {
    const target = $state.config.target(row);
    const issue = {} as Issue;
    if (target === source) {
      ($state.issues[row] = issue).selflink = target;
      allValids.push(row);
    } else if (!$state.loc(target)) {
      ($state.issues[row] = issue).unlocate = target;
    } else if (+weight(row) <= 0) {
      ($state.issues[row] = issue).negative = target;
    } else {
      groupValid.push(row);
      allValids.push(row);
    }
  }
  flows.add(groupValid);
  resetColor();
  resetWidth();
  flows.reformat(true, true);
  legend.resize();
  pies.reset(allValids);
  popups.repaint();
}

export function repaint(cfg: Config<any>, type: 'flow' | 'banner' | 'legend' | 'bubble' | 'map') {
  $state.reset(cfg);
  if (type === 'flow') {
    resetColor();
    resetWidth();
    legend.resize();
    pies.reset(allValids);
    flows.reformat(true, true);
    popups.repaint();
  } else if (type === 'legend') {
    legend.resize();
    resetColor();
    resetWidth();
    legend.resize();
  } else if (type === 'bubble') {
    pies.reset(allValids);
    popups.repaint();
  } else if (type === 'banner') {
    popups.repaint();
  } else {
    if (cfg.centerZoom && cfg.centerZoom.center && cfg.centerZoom.zoom != null) {
      $state.mapctl.setCenterZoom(cfg.centerZoom.center, cfg.centerZoom.zoom);
    }
  }
}

function resetWidth() {
  const weight = $state.config.weight;
  const domain = flows.reweight(weight.conv);
  const [dmin, dmax] = domain;
  let invert: Func<number, number> = null;

  if ('max' in weight) {
    const { min, max } = weight, range = [min, max];
    if (weight.scale === 'log') {
      let exp = 0.5;
      const pow = scaleSqrt().domain([0, dmax]).range([0, max]);
      while (pow(dmin) > +min && exp < 1.1) pow.exponent(exp += 0.1);
      if (pow(dmin) > min) {
        $state.width = pow;
        invert = pow.invert.bind(pow);
      } else {
        const lin = scaleLinear().domain([pow(dmin), max]).range(range);
        $state.width = w => lin(pow(w));
        invert = r => pow.invert(lin.invert(r));
      }
    } else {
      const lin = scaleLinear().domain([0, dmax]).range([0, max]);
      if (lin(dmin) < min) lin.domain(domain).range(range);
      $state.width = lin;
      invert = lin.invert.bind(lin);
    }
    legend.rewidth({ invert, scale: $state.width, dmax });
  } else if ('unit' in weight) {
    if (weight.unit === null) weight.unit = dmin === dmax ? 3 / dmin : 25 / dmax;
    const lin = scaleLinear().domain(domain).range(domain.map(d => d * weight.unit));
    $state.width = lin;
    invert = lin.invert.bind(lin);
    legend.rewidth({ invert, scale: lin, dmax });
  } else if (weight.scale === null) {
    $state.width = scaleIdentity();
    invert = scaleIdentity();
    legend.rewidth({ distinct: $state.config.legend.widthLabels });
  }
}

function resetColor() {
  if ($state.config.legend.colorLabels) {
    legend.recolor({ distinct: $state.config.legend.colorLabels });
  }
  if ($state.config.color.max) {
    const value = $state.config.color;
    const domain = extent(allValids, r => value(r) as number);
    const range = [value.min, value.max];
    const scale = scaleLinear<string>().domain(domain).range(range)
      .interpolate(interpolateRgb).clamp(true);
    $state.color = r => scale(value(r) as number);
    if (!$state.config.legend.colorLabels) legend.recolor({ domain, range });
  } else {
    $state.color = $state.config.color as Func<number, string>;
  }
}
