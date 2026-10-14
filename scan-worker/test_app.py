"""Exercise upload authorization and file handling without running COLMAP."""

import importlib
import io
import os
import sys
import tempfile
import unittest
from pathlib import Path
from uuid import uuid4

import jwt
from fastapi.testclient import TestClient
from PIL import Image


class NoopExecutor:
    def submit(self, *_args):
        return None


class WorkerAPITest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary = tempfile.TemporaryDirectory()
        os.environ["SCAN_DATA_DIR"] = cls.temporary.name
        os.environ["SCAN_WORKER_SECRET"] = "a-secret-value-with-more-than-32-characters"
        os.environ["PUBLIC_BASE_URL"] = "https://ar.example.com"
        os.environ["POLO_CALLBACK_URL"] = "https://polo.example.com/api/scan-callback"
        os.environ["POLO_ORIGIN"] = "https://polo.example.com"
        sys.path.insert(0, str(Path(__file__).parent))
        cls.worker = importlib.import_module("app")
        cls.worker.executor = NoopExecutor()
        cls.client = TestClient(cls.worker.app)
        image = Image.new("RGB", (800, 800), (130, 90, 50))
        output = io.BytesIO()
        image.save(output, "JPEG")
        cls.photo = output.getvalue()

    @classmethod
    def tearDownClass(cls):
        cls.client.close()
        cls.temporary.cleanup()

    def token(self, scan_id):
        return jwt.encode({"sub": str(scan_id), "iss": "polo", "aud": "polo-scan-worker",
                           "purpose": "upload", "diameterCm": 28},
                          os.environ["SCAN_WORKER_SECRET"], algorithm="HS256")

    def test_signed_upload_and_private_status(self):
        scan_id = uuid4()
        files = [("photos", (f"{index}.jpg", self.photo, "image/jpeg")) for index in range(20)]
        denied = self.client.post("/jobs", files=files)
        self.assertEqual(denied.status_code, 401)
        accepted = self.client.post("/jobs", files=files,
                                    headers={"Authorization": f"Bearer {self.token(scan_id)}"})
        self.assertEqual(accepted.status_code, 202)
        self.assertEqual(len(list((self.worker.JOBS / str(scan_id) / "images").glob("*.jpg"))), 20)
        self.assertEqual(self.client.get(f"/jobs/{scan_id}").status_code, 401)
        self.assertEqual(self.client.get(f"/jobs/{scan_id}",
                                         headers={"X-Worker-Key": os.environ["SCAN_WORKER_SECRET"]}).json()["status"], "queued")
        self.assertEqual(self.client.post("/jobs", files=files,
                                          headers={"Authorization": f"Bearer {self.token(scan_id)}"}).status_code, 409)

    def test_rejects_too_few_photos(self):
        scan_id = uuid4()
        result = self.client.post("/jobs", files=[("photos", ("one.jpg", self.photo, "image/jpeg"))],
                                  headers={"Authorization": f"Bearer {self.token(scan_id)}"})
        self.assertEqual(result.status_code, 400)
        self.assertFalse((self.worker.JOBS / str(scan_id)).exists())


if __name__ == "__main__":
    unittest.main()
