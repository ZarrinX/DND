#!/usr/bin/env node
// Converts ../icon.svg → resources/icon.png (256×256)
// Run before building: npm run generate-icon

const { Resvg } = require('@resvg/resvg-js')
const { readFileSync, writeFileSync } = require('fs')
const { join } = require('path')

const svgPath = join(__dirname, '../../icon.svg')
const outPath = join(__dirname, '../resources/icon.png')

const svg = readFileSync(svgPath, 'utf-8')
const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 256 } })
const png = resvg.render().asPng()
writeFileSync(outPath, png)
console.log(`Icon written to ${outPath}`)
