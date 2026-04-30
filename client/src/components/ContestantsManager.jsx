import { useState, useMemo, useRef, useEffect } from 'react';
import { contestantsAPI } from '../api';
import { useCrudResource } from '../hooks/useCrudResource';
import { useFaceDetection } from '../hooks/useFaceDetection';
import { Trash2, Plus, Upload, Image, X, Crop } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

export default function ContestantsManager({ eventId }) {
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  const [photoPreview, setPhotoPreview] = useState({});
  const [cropModal, setCropModal] = useState(null);
  const [cropSrc, setCropSrc] = useState(null);
  const [cropState, setCropState] = useState(null);
  const fileInputRef = useRef({});
  const imageRef = useRef(null);
  
  const { loadModels, detectFaceFromFile, modelsLoaded: modelsLoaded } = useFaceDetection();
  const [loadingModels, setLoadingModels] = useState(false);

  const { items: contestants, loading, error, success, handleCreate, handleDelete, refresh } = useCrudResource(
    contestantsAPI,
    { collectionKey: eventId }
  );

  const activeContestants = useMemo(
    () => contestants.filter((c) => c.status === 'active'),
    [contestants]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();

    const num = parseInt(number, 10);
    if (isNaN(num) || num < 1) return;
    if (!name.trim()) return;

    const ok = await handleCreate({
      number: num,
      name: name.trim(),
    });

    if (ok) {
      setNumber('');
      setName('');
    }
  };

  const handleWithdraw = async (id, contestantName) => {
    setConfirmDelete({
      open: true,
      title: 'Withdraw Contestant',
      message: `Mark "${contestantName}" as withdrawn? They will no longer appear in scoring.`,
      confirmLabel: 'Withdraw',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDelete(null);
        await handleDelete(id);
      },
      onCancel: () => setConfirmDelete(null),
    });
  };

  // Load models on first mount
  useEffect(() => {
    if (!modelsLoaded && !loadingModels) {
      setLoadingModels(true);
      loadModels().finally(() => setLoadingModels(false));
    }
  }, [loadModels, modelsLoaded, loadingModels]);

  // 15.5.2: Cleanup object URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      Object.values(photoPreview).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
      if (cropSrc) URL.revokeObjectURL(cropSrc);
    };
  }, [photoPreview, cropSrc]);

  const handlePhotoSelect = async (contestant) => {
    const input = fileInputRef.current[contestant.id];
    if (!input) return;
    input.click();
  };

  const handlePhotoChange = async (e, contestant) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingId(contestant.id);
    
    try {
      // Try face detection if models are loaded
      let faceBox = null;
      if (modelsLoaded) {
        faceBox = await detectFaceFromFile(file);
      }

      if (faceBox) {
        // Face detected - use Sharp's centered crop from detected face
        const formData = new FormData();
        formData.append('photo', file);
        await contestantsAPI.uploadPhoto(eventId, contestant.id, file);
        setPhotoPreview((prev) => ({ ...prev, [contestant.id]: URL.createObjectURL(file) }));
        refresh();
      } else {
        // No face detected or models not loaded - show manual crop modal
        const previewUrl = URL.createObjectURL(file);
        setCropSrc(previewUrl);
        setCropModal({ contestant, file });
      }
    } catch (err) {
      console.error('Failed to upload photo:', err);
    } finally {
      setUploadingId(null);
    }
    
    e.target.value = '';
  };

  const handleCropComplete = async () => {
    if (!cropSrc || !cropState || !cropModal) return;

    const { contestant, file } = cropModal;

    // Create cropped image from crop state
    const img = imageRef.current;
    if (!img) return;

    const scaleX = img.naturalWidth / cropState.width;
    const scaleY = img.naturalHeight / cropState.height;

    const canvas = document.createElement('canvas');
    canvas.width = cropState.width;
    canvas.height = cropState.height;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(
      img,
      cropState.x * scaleX,
      cropState.y * scaleY,
      cropState.width * scaleX,
      cropState.height * scaleY,
      0,
      0,
      cropState.width,
      cropState.height
    );

    // Convert to blob
    const croppedFile = await new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/webp', 0.7);
    });

    setUploadingId(contestant.id);
    
    try {
      await contestantsAPI.uploadPhoto(eventId, contestant.id, croppedFile);
      setPhotoPreview((prev) => ({ ...prev, [contestant.id]: URL.createObjectURL(croppedFile) }));
      refresh();
      setCropModal(null);
      setCropSrc(null);
      setCropState(null);
    } catch (err) {
      console.error('Failed to upload cropped photo:', err);
    } finally {
      setUploadingId(null);
    }
  };

  const handleSkipCrop = async () => {
    if (!cropModal) return;
    
    const { contestant, file } = cropModal;
    
    setUploadingId(contestant.id);
    
    try {
      await contestantsAPI.uploadPhoto(eventId, contestant.id, file);
      setPhotoPreview((prev) => ({ ...prev, [contestant.id]: URL.createObjectURL(file) }));
      refresh();
      setCropModal(null);
      setCropSrc(null);
      setCropState(null);
    } catch (err) {
      console.error('Failed to upload photo:', err);
    } finally {
      setUploadingId(null);
    }
  };

  const getPhotoUrl = (contestantId) => {
    if (photoPreview[contestantId]) return photoPreview[contestantId];
    return `/api/events/${eventId}/contestants/${contestantId}/photo`;
  };

  return (
    <div className="bg-[var(--color-bg-subtle)] rounded-xl shadow-sm border border-[var(--color-border)] p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-[var(--color-text)]">Contestants</h2>
        {loadingModels && (
          <span className="text-xs text-[var(--color-text-muted)]">Loading face detection...</span>
        )}
      </div>

      {/* Add Contestant Form */}
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="number"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="Contestant #"
          min="1"
          className="w-32 px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-cta)] focus:border-[var(--color-cta)] outline-none bg-[var(--color-bg)] text-[var(--color-text)]"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Contestant name"
          className="flex-1 px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-cta)] focus:border-[var(--color-cta)] outline-none bg-[var(--color-bg)] text-[var(--color-text)]"
        />
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-cta)] hover:opacity-90 disabled:opacity-50 text-white font-medium rounded-lg transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Add Contestant
        </button>
      </form>

      {/* Feedback */}
      {error && (
        <div className="text-sm text-red-500 bg-red-500/10 px-4 py-2 rounded-lg mb-4">
          {error}
        </div>
      )}
      {success && (
        <div className="text-sm text-green-500 bg-green-500/10 px-4 py-2 rounded-lg mb-4">
          {success}
        </div>
      )}

      {/* Contestants Table */}
      {activeContestants.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left py-3 px-4 text-[var(--color-text-muted)] font-medium">Photo</th>
                <th className="text-left py-3 px-4 text-[var(--color-text-muted)] font-medium">#</th>
                <th className="text-left py-3 px-4 text-[var(--color-text-muted)] font-medium">Name</th>
                <th className="text-left py-3 px-4 text-[var(--color-text-muted)] font-medium">Status</th>
                <th className="text-right py-3 px-4 text-[var(--color-text-muted)] font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeContestants.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg)] transition"
                >
                  <td className="py-3 px-4">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-[var(--color-bg-subtle)] border border-[var(--color-border)]">
                      {uploadingId === c.id ? (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-4 h-4 border-2 border-[var(--color-cta)] border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : (
                        <button
                          onClick={() => handlePhotoSelect(c)}
                          className="w-full h-full flex items-center justify-center hover:bg-[var(--color-bg-subtle)] transition"
                          title="Upload photo"
                        >
                          <Image className="w-5 h-5 text-[var(--color-text-muted)]" />
                        </button>
                      )}
                    </div>
                    <input
                      ref={(el) => (fileInputRef.current[c.id] = el)}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handlePhotoChange(e, c)}
                    />
                  </td>
                  <td className="py-3 px-4 text-[var(--color-text)] font-medium">{c.number}</td>
                  <td className="py-3 px-4 text-[var(--color-text)]">{c.name}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500">
                      Active
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleWithdraw(c.id, c.name)}
                      className="text-red-500 hover:text-red-400 transition-colors p-1"
                      title="Withdraw contestant"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 text-[var(--color-text-muted)]">
          No contestants added yet. Add your first contestant above.
        </div>
      )}
      <ConfirmDialog {...confirmDelete} />

      {/* Manual Crop Modal */}
      {cropModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-[var(--color-bg)] rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--color-text)]">Adjust Photo Position</h3>
              <button onClick={() => { setCropModal(null); setCropSrc(null); }} className="text-[var(--color-text-muted)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              Face not detected or position unclear. Drag to select the face area:
            </p>

            <div className="flex justify-center mb-4">
              {cropSrc && (
                <ReactCrop
                  crop={cropState}
                  onChange={(c) => setCropState(c)}
                  aspect={1}
                  circularCrop
                >
                  <img
                    ref={imageRef}
                    src={cropSrc}
                    alt="Crop preview"
                    className="max-h-64"
                  />
                </ReactCrop>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSkipCrop}
                className="flex-1 px-4 py-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text)] hover:bg-[var(--color-bg-subtle)]"
              >
                Skip (use original)
              </button>
              <button
                onClick={handleCropComplete}
                disabled={!cropState}
                className="flex-1 px-4 py-2 bg-[var(--color-cta)] hover:opacity-90 disabled:opacity-50 text-white rounded-lg"
              >
                Save Crop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}