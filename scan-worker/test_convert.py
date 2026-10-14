"""Keep the photo atlas and physical size through PLY -> GLB conversion."""

import sys
import tempfile
import unittest
from pathlib import Path

import trimesh
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from convert import convert  # noqa: E402


class ConversionTest(unittest.TestCase):
    def test_textured_mesh_is_embedded_at_plate_size(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            texture = root / "texture.png"
            Image.new("RGB", (4, 4), (120, 30, 20)).save(texture)
            source = root / "mesh.ply"
            source.write_text("""ply
format ascii 1.0
comment TextureFile texture.png
element vertex 4
property float x
property float y
property float z
element face 2
property list uchar int vertex_indices
property list uchar float texcoord
end_header
-1 -1 0
1 -1 0
1 1 0
-1 1 0
3 0 1 2 6 0 0 1 0 1 1
3 0 2 3 6 0 0 1 1 0 1
""", encoding="ascii")
            target = root / "plato.glb"
            convert(source, texture, target, 28)
            model = trimesh.load_mesh(target)
            self.assertAlmostEqual(max(model.extents[0], model.extents[2]), 0.28, places=4)
            self.assertEqual(model.visual.kind, "texture")
            self.assertIsNotNone(model.visual.material.baseColorTexture)


if __name__ == "__main__":
    unittest.main()
