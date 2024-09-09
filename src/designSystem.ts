import resolveConfig from "tailwindcss/resolveConfig"
import tailwindConfigData from "../tailwind.config"
export const tw = resolveConfig(tailwindConfigData)

export const designSystem = {
  light: {
    canvasBackground: tw.theme.colors.white,
    canvasBackgroundDot: tw.theme.colors.gray[300],

    selectionDragBoxStroke: tw.theme.colors.gray[500],
    selectionDragBoxFill: tw.theme.colors.gray[200],
    selectionDragBoxFillOpacity: 0.25,
    selectionBox: tw.theme.colors.brand[500],

    bezierPointFill: tw.theme.colors.white,
    bezierPointStroke: tw.theme.colors.brand[500],
    bezierPointFillSelected: tw.theme.colors.brand[500],
    bezierPointStrokeSelected: tw.theme.colors.white,

    bezierControlPointFill: tw.theme.colors.white,
    bezierControlPointStroke: tw.theme.colors.brand[500],
    bezierControlPointFillSelected: tw.theme.colors.brand[500],
    bezierControlPointStrokeSelected: tw.theme.colors.white,
    bezierControlPointArmStroke: tw.theme.colors.brand[500],
    bezierControlPointArmWidth: 1,
    bezierControlPointWidth: 3,
    bezierControlPointHitRadius: 5,

    debugText: tw.theme.colors.black,
  },
  dark: {
    canvasBackground: tw.theme.colors.gray[900],
    canvasBackgroundDot: tw.theme.colors.gray[700],

    selectionDragBoxStroke: tw.theme.colors.gray[400],
    selectionDragBoxFill: tw.theme.colors.gray[700],
    selectionDragBoxFillOpacity: 0.25,
    selectionBox: tw.theme.colors.brand[400],

    bezierPointFill: tw.theme.colors.gray[900],
    bezierPointStroke: tw.theme.colors.brand[400],
    bezierPointFillSelected: tw.theme.colors.brand[400],
    bezierPointStrokeSelected: tw.theme.colors.gray[900],

    bezierControlPointFill: tw.theme.colors.gray[900],
    bezierControlPointStroke: tw.theme.colors.brand[400],
    bezierControlPointFillSelected: tw.theme.colors.brand[400],
    bezierControlPointStrokeSelected: tw.theme.colors.gray[900],
    bezierControlPointArmStroke: tw.theme.colors.brand[400],
    bezierControlPointArmWidth: 1,
    bezierControlPointWidth: 3,
    bezierControlPointHitRadius: 5,

    debugText: tw.theme.colors.white,
  },
}
