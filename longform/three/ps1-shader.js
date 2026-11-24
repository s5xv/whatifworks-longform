/**
 * ps1-shader.js (16:9 960x540 PS1 preset)
 * Authentic retro PS1 vertex-snap and 4x4 Bayer ordered dithering shader patch.
 */

export function applyPS1Material(mat, opts = {}) {
  const snapX = opts.snapX || 480.0; // 960 / 2
  const snapY = opts.snapY || 270.0; // 540 / 2
  const colorLevels = opts.colorLevels || 31.0;

  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `
      #include <project_vertex>
      if (gl_Position.w > 0.0) {
        vec2 sn = vec2(${snapX.toFixed(1)}, ${snapY.toFixed(1)});
        gl_Position.xy = floor(gl_Position.xy / gl_Position.w * sn + 0.5) / sn * gl_Position.w;
      }
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `
      #include <dithering_fragment>
      {
        const float BY[16] = float[16](
          0.0, 8.0, 2.0, 10.0,
          12.0, 4.0, 14.0, 6.0,
          3.0, 11.0, 1.0, 9.0,
          15.0, 7.0, 13.0, 5.0
        );
        ivec2 q = ivec2(mod(gl_FragCoord.xy, 4.0));
        float th = (BY[q.x + q.y * 4] + 0.5) / 16.0 - 0.5;
        gl_FragColor.rgb = clamp(floor(gl_FragColor.rgb * ${colorLevels.toFixed(1)} + th + 0.5) / ${colorLevels.toFixed(1)}, 0.0, 1.0);
      }
      `
    );
  };
  mat.customProgramCacheKey = () => `ps1_${snapX}_${snapY}_${colorLevels}`;
  return mat;
}
