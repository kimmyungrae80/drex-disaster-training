from pathlib import Path
root=Path(__file__).parent
html=(root/'index.html').read_text()
css=(root/'style.css').read_text()
engine=(root/'engine.mjs').read_text().replace('export ','')
mapcode=(root/'map.mjs').read_text().replace('export ','')
app='\n'.join(line for line in (root/'app.mjs').read_text().splitlines() if not line.startswith('import '))
html=html.replace('<link rel="stylesheet" href="vendor/leaflet.css">','<style>'+(root/'vendor/leaflet.css').read_text()+'</style>')
html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>')
html=html.replace('<script src="vendor/leaflet.js"></script>','<script>'+(root/'vendor/leaflet.js').read_text().replace('//# sourceMappingURL=leaflet.js.map','')+'</script>')
html=html.replace('<script type="module" src="app.mjs"></script>','<script type="module">'+engine+'\n'+mapcode+'\n'+app+'</script>')
(root/'preview.html').write_text(html)
