"use client";

import { useState } from "react";
import { useUploadThing } from "@/lib/uploadthing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface UploadThingProps {
  onUpload: (url: string) => void;
}

export function UploadThing({ onUpload }: UploadThingProps) {
  const [file, setFile] = useState<File | null>(null);
  const { startUpload, isUploading } = useUploadThing("imageUploader", {
    onClientUploadComplete: (res) => {
      if (res && res.length > 0) {
        onUpload(res[0].url);
      }
      alert("Upload Completed");
    },
    onUploadError: (error: Error) => {
      alert(`ERROR! ${error.message}`);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (file) {
      startUpload([file]);
    }
  };

  return (
    <div>
      <div className="flex items-center space-x-2">
        <Input type="file" onChange={handleFileChange} />
        <Button onClick={handleUpload} disabled={!file || isUploading}>
          {isUploading ? "Uploading..." : "Upload"}
        </Button>
      </div>
      {isUploading && (
        <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
          <div
            className="bg-blue-600 h-2.5 rounded-full"
            style={{ width: `50%` }}
          ></div>
        </div>
      )}
    </div>
  );
}
