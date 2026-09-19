from pathlib import Path
root=Path(__file__).parent
html=(root/'index.html').read_text()
css=(root/'style.css').read_text()
engine=(root/'engine.mjs').read_text().replace('export ','')
app=(root/'app.mjs').read_text().split('\n',1)[1]
html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>')
html=html.replace('<script type="module" src="app.mjs"></script>','<script type="module">'+engine+'\n'+app+'</script>')
(root/'preview.html').write_text(html)
