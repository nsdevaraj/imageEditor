export const sampleScene = {
  meta: {
    image_quality: 'High',
    image_type: 'Editorial poster',
    resolution_estimation: '1000 x 1250 pixels',
  },
  global_context: {
    scene_description:
      'A pale green editorial poster with a dark green heading, a photograph of gardening tools and plants, and a compact footer. This is a hand-authored sample record, not a live AI analysis.',
    time_of_day: null,
    weather_atmosphere: 'Calm indoor setting',
    lighting: {
      source: 'Natural light in the photograph',
      direction: 'Side',
      quality: 'Soft',
      color_temp: 'Neutral',
    },
  },
  color_palette: {
    dominant_hex_estimates: ['#f0f3ed', '#193d2d', '#3d5548'],
    accent_colors: ['Foliage green', 'Terracotta'],
    contrast_level: 'Medium',
  },
  composition: {
    camera_angle: 'Flat graphic with inset photograph',
    framing: 'Portrait poster',
    depth_of_field: null,
    focal_point: 'Room to grow. heading and gardening photograph',
  },
  objects: [
    {
      id: 'obj_001',
      label: 'Poster',
      category: 'Graphic',
      location: 'Full frame',
      prominence: 'Foreground',
      visual_attributes: {
        color: 'Pale green with dark green type',
        texture: 'Flat',
        material: null,
        state: 'Clean',
        dimensions_relative: 'Full frame',
      },
      micro_details: [
        'Wide margins',
        'Left-aligned type',
        'Rectangular inset photograph',
      ],
      pose_or_orientation: 'Portrait',
      text_content: 'Room to grow.',
    },
    {
      id: 'obj_002',
      label: 'Gardening photograph',
      category: 'Photograph',
      location: 'Center lower half',
      prominence: 'Foreground',
      visual_attributes: {
        color: 'Green foliage, earthy pots and neutral background',
        texture: 'Organic foliage and soil',
        material: null,
        state: null,
        dimensions_relative: '820 x 660 pixels',
      },
      micro_details: ['Gardening tools', 'Potted foliage', 'Natural shadows'],
      pose_or_orientation: 'Landscape inset',
      text_content: null,
    },
  ],
  text_ocr: {
    present: true,
    content: [
      {
        text: 'FIELD NOTES     /     VOL. 003',
        location: 'Top-left, above headline',
        font_style: 'Small sans-serif capitals',
        legibility: 'Clear',
      },
      {
        text: 'Room to grow.',
        location: 'Upper-left headline',
        font_style: 'Large bold sans-serif',
        legibility: 'Clear',
      },
      {
        text: 'A slower kind of living.',
        location: 'Under the headline',
        font_style: 'Regular sans-serif',
        legibility: 'Clear',
      },
      {
        text: 'THE EVERYDAY BOTANICAL',
        location: 'Bottom-left footer heading',
        font_style: 'Bold sans-serif capitals',
        legibility: 'Clear',
      },
      {
        text: 'Objects. Spaces. Small rituals.',
        location: 'Bottom-left footer subtitle',
        font_style: 'Regular sans-serif',
        legibility: 'Clear',
      },
    ],
  },
  semantic_relationships: [
    'The headline sits above the photograph.',
    'The footer sits below the photograph.',
  ],
}
