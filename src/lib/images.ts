export const roomImages = import.meta.glob<{ default: ImageMetadata }>('../assets/images/rooms/*.png', { eager: true });

export const getRoomImages = (paths: string[]) => {
    return paths.map(path => {
        // Convertir ruta relativa a la ruta esperada por glob
        // Ejemplo: "/src/assets/images/rooms/simple.png" -> "../assets/images/rooms/simple.png"
        const globPath = path.replace('/src/', '../');
        return roomImages[globPath]?.default?.src || path;
    });
};
