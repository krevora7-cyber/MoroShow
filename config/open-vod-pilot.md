# MoroShow free playback pilot

Run the pilot in a local environment that already has the MoroShow backend and TMDB configured.

```sh
MOROSHOW_MOVIE_PLAYBACK=direct-only \
MOROSHOW_NATIVE_HLS_CATALOG="$(cat config/open-vod-pilot.json)" \
npm run dev
```

Search for Big Buck Bunny or Caminandes. The pilot includes two delivery endpoints for Big Buck Bunny and one per Caminandes episode. The Mux endpoint is a public test stream. Arrange production hosting before relying on public demo and archive servers for regular traffic.

The preset is limited to these titles. Verify the Caminandes episode mapping against the configured TMDB account before enabling the preset on a shared environment.

## Content credits

Keep the original credits and include the attribution on the title page for public playback.

- **Big Buck Bunny** by Blender Foundation. [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) and [original attribution terms](https://peach.blender.org/about/).
- **Caminandes 1: Llama Drama** by Pablo Vazquez, Beorn Leonard, and Francesco Siddi, with music and sound by Jan Morgenstern. [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) and [source and credits](https://commons.wikimedia.org/wiki/File:Caminandes-_Llama_Drama_-_Short_Movie.ogv).
- **Caminandes 2: Gran Dillama** by Blender Foundation. [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) and [source and credits](https://commons.wikimedia.org/wiki/File:Caminandes,_Gran_Dillama_-_Blender_Foundation.webm).
- **Caminandes 3: Llamigos** by Blender. [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) and [source and credits](https://commons.wikimedia.org/wiki/File:Caminandes_3_-_Llamigos_-_Blender_Animated_Short.webm).
