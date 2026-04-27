import React, { useState } from 'react';
import axios from 'axios';

const ImportExcel: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);

  const upload = () => {
    if (!file) {
      alert('Please select a file first');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    axios.post('http://localhost:3000/api/import', formData)
      .then((response) => {
        console.log('File uploaded successfully:', response.data);
      })
      .catch((error) => {
        console.error('Error uploading file:', error);
      });
  };

  return (
    <div>
      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
          }
        }}
      />

      <button type="button" onClick={upload}>
        Upload
      </button>
    </div>
  );
};

export default ImportExcel;