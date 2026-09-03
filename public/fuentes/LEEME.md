# Tipografías de la marca

Aquí van los archivos de fuente, que **no vienen con el proyecto**: Canva Sans
y Canva Display son tipografías propietarias de Canva y su licencia no cubre
servirlas desde un sitio propio, así que las aporta quien tenga los derechos.

Los nombres tienen que ser exactamente estos, en minúsculas y en formato
`.woff2`, que es el que pesa menos y entienden todos los navegadores:

    canva-sans-regular.woff2      texto general de la aplicación
    canva-display-regular.woff2   opción "Display Regular" del editor
    canva-display-medium.woff2    opción "Display Medium"
    canva-display-bold.woff2      opción "Display Bold"

Mientras falte alguno, el navegador usa la tipografía del sistema y el texto se
lee igual: no hay que tocar código para activarlas, basta con subir el archivo
con el nombre correcto.

Si solo tienes `.ttf` o `.otf`, se convierten a `.woff2` con cualquier
conversor; el formato importa porque un `.ttf` puede pesar cinco veces más y
esta página la abren también desde el móvil.
