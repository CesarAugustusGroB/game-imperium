declare module '*&as=picture' {
  const value: {
    sources: Record<string, string>;
    img: { src: string; w: number; h: number };
  };
  export default value;
}

/** Single optimized URL form (vite-imagetools): import a transformed WebP as a
 *  plain string for use in `url(...)` CSS backgrounds. Query must END with
 *  `&format=webp` to match this glob. */
declare module '*&format=webp' {
  const src: string;
  export default src;
}
