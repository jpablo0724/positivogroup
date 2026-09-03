# Tipografías de la marca

Ya cargadas: la familia **Canva Sans Display**, en tres pesos (Regular,
Medium, Bold), convertida de `.otf` a `.woff2` para que pese menos y la
entiendan todos los navegadores.

    canva-display-regular.woff2   opción "Display Regular" del editor
    canva-display-medium.woff2    opción "Display Medium"
    canva-display-bold.woff2      opción "Display Bold"
    canva-sans-regular.woff2      texto general de la aplicación
                                   (mismo archivo que Display Regular:
                                   no se aportó un corte de solo texto)

Si más adelante llega un archivo de **Canva Sans** propiamente (no Display,
para párrafos largos), reemplaza `canva-sans-regular.woff2` por ese —
convertido a `.woff2` con el mismo nombre — y el cuerpo de la aplicación
pasará a usarlo sin tocar código.

## Cómo se convirtió

```bash
python3 -c "
from fontTools.ttLib import TTFont
t = TTFont('archivo.otf')
t.flavor = 'woff2'
t.save('archivo.woff2')
"
```

(`pip install fonttools brotli`)
