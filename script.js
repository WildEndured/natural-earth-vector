* { margin: 0; padding: 0; box-sizing: border-box; }

body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }

#map { width: 100vw; height: 100vh; background: #a8d5ff; }

.info-panel {
  position: absolute; top: 20px; right: 20px; z-index: 1000;
  background: rgba(255,255,255,.96); padding: 15px 20px;
  border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,.2);
  min-width: 240px; max-width: 340px; max-height: 70vh; overflow-y: auto;
}
.info-panel h3 {
  font-size: 16px; color: #333; margin-bottom: 8px;
  border-bottom: 2px solid #4a90e2; padding-bottom: 5px;
}
#countryInfo p { font-size: 14px; color: #555; line-height: 1.55; margin: 3px 0; }
#countryInfo strong { color: #222; }

.controls {
  position: absolute; top: 20px; left: 20px; z-index: 1000;
  background: rgba(255,255,255,.96); padding: 12px 16px;
  border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,.2);
  font-size: 13px; width: 220px; max-height: 80vh; overflow-y: auto;
}
.controls h4 { font-size: 14px; margin-bottom: 8px; color: #333; }
.controls .group { margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #eee; }
.controls .group-title { font-weight: 600; color: #4a90e2; font-size: 12px; margin: 6px 0 4px; text-transform: uppercase; }
.controls label { display: flex; align-items: center; gap: 6px; cursor: pointer; padding: 2px 0; }
.controls label:hover { background: #f0f4f8; border-radius: 3px; }
.status {
  margin-top: 8px; padding-top: 8px; border-top: 1px solid #ddd;
  font-size: 11px; color: #666; word-break: break-word;
}

.legend {
  position: absolute; bottom: 30px; left: 20px; z-index: 1000;
  background: rgba(255,255,255,.96); padding: 12px 16px;
  border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,.2); font-size: 13px;
}
.legend h4 { margin-bottom: 8px; font-size: 14px; }
.swatch {
  display: inline-block; width: 16px; height: 16px;
  margin-right: 6px; vertical-align: middle; border-radius: 2px;
}
.swatch.country { background: #4a90e2; border: 1px solid #2c5f8a; }
.swatch.dispute { background: #e74c3c; border: 1px solid #8b1a1a; }
.swatch.city    { background: #e74c3c; border-radius: 50%; }
.swatch.lake    { background: #3498db; border: 1px solid #1f5f8b; }
.swatch.river   { background: #2980b9; height: 3px; }

@media (max-width: 700px) {
  .info-panel { top: 10px; right: 10px; padding: 10px; min-width: 160px; font-size: 12px; max-height: 40vh; }
  .controls   { top: 10px; left: 10px; padding: 8px; font-size: 12px; width: 170px; max-height: 50vh; }
  .legend     { bottom: 10px; left: 10px; padding: 8px; font-size: 11px; }
               }
