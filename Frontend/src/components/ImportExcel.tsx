import React, { useState } from 'react';
import axios from 'axios';
import { useSnackbar } from 'notistack';

const ImportExcel: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const { enqueueSnackbar } = useSnackbar();

  const upload = () => {
    if (!file) {
      enqueueSnackbar('Please select a file first', { variant: 'warning' });
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    axios.post('http://localhost:3000/api/import', formData)
      .then((response) => {
        console.log('File uploaded successfully:', response.data);
        enqueueSnackbar('File uploaded successfully', { variant: 'success' });
      })
      .catch((error) => {
        console.error('Error uploading file:', error);
        enqueueSnackbar('Error uploading file', { variant: 'error' });
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