// Global toggles for game rendering and behavior

// When true, hides narrative text and cinematic prompts, relying entirely on images and NPC dialogue arrays.
export const ONLY_IMAGES = false;

// When true, the server will automatically generate a starter image using the level's starting text 
// when the session is created. Once generated, you can save this image to `public/assets/starting_image.png` 
// and set this back to false to use the static asset.
export const GEN_STARTER = false;