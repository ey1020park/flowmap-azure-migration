// 파일: src/lava/flowmap/config.ts (Azure Maps 버전에 맞게 수정)

import { StringMap } from "../type";
import { ILocation, MapFormat } from "../azuremap"; // ✅ bingmap → azuremap으로 변경
import { Setting } from "../../pbi/numberFormat";
import { Context } from "../../pbi"; // 경로는 실제 위치에 맞게 조정


type Func<T = string> = (i: number) => T;

export class Config<F> {
    public context: Context<any, F>; // ✅ 추가
    constructor(ctx: Context<any, F>) {
        this.context = ctx;
        // ... 나머지 초기화
      }    

    error = null as string;
    advance = {
        relocate: false,
        located: true,
        unlocated: true
    };

    style = null as 'straight' | 'flow' | 'arc';
    source = null as Func;
    target = null as Func;
    groups = null as number[][];

    color = null as Func<number | string> & { min?: string, max?: string };

    weight = null as
        { conv: Func<number>; min: number; max: number; scale: 'linear' | 'log'; } |
        { conv: Func<number>; unit: number; scale: 'none' } |
        { conv: Func<number>; scale: null };

    popup = {
        description: null as Func,
        origin: null as Func,
        destination: null as Func
    };

    legend = {
        show: false,
        fontSize: 12,
        position: 'top' as 'top' | 'bottom',
        color: true,
        width: true,
        colorLabels: {} as StringMap<string>,
        widthLabels: {} as StringMap<string>
    };

    map = new MapFormat();

    // Azure Maps에서는 별도로 center/zoom 상태를 저장해둬야 재설정 가능함
    centerZoom?: {
        center: [number, number];
        zoom: number;
    };

    bubble = {
        for: null as 'none' | 'origin' | 'dest' | 'both',
        slice: null as boolean,
        bubbleColor: { solid: { color: '#888888' } },
        scale: 25,
        label: 'none' as 'none' | 'all' | 'manual' | 'hide',
        labelOpacity: 50,
        labelColor: { solid: { color: '#888888' } },
        in: null as Func,
        out: null as Func
    };

    injections = {} as StringMap<ILocation>;

    numberSorter = { sort: 'des' as 'asc' | 'des', top: 10 };
    numberFormat = new Setting();
}
