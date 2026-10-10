import {beforeEach, expect, it, vi} from 'vitest';
const mocks = vi.hoisted(() => ({cameraPermission: vi.fn(), galleryPermission: vi.fn(), camera: vi.fn(), gallery: vi.fn(), manipulate: vi.fn(), save: vi.fn()}));
vi.mock('../mobile/node_modules/expo-image-picker', () => ({requestCameraPermissionsAsync: mocks.cameraPermission, requestMediaLibraryPermissionsAsync: mocks.galleryPermission, launchCameraAsync: mocks.camera, launchImageLibraryAsync: mocks.gallery}));
vi.mock('../mobile/node_modules/expo-image-manipulator', () => ({SaveFormat: {JPEG: 'jpeg'}, manipulateAsync: mocks.manipulate}));
vi.mock('../mobile/src/lib/session', () => ({setBoard: mocks.save}));
import {pickAvatar} from '../mobile/src/lib/avatar';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.gallery.mockResolvedValue({canceled: false, assets: [{uri: 'selected-image', width: 800, height: 400}]});
  mocks.manipulate.mockResolvedValue({base64: 'selected-image-bytes'});
});
it('uses the selected image without requesting permission to read the whole gallery', async () => {
  expect(await pickAvatar('gallery')).toBeNull();
  expect(mocks.galleryPermission).not.toHaveBeenCalled();
  expect(mocks.cameraPermission).not.toHaveBeenCalled();
  expect(mocks.gallery).toHaveBeenCalledWith(expect.objectContaining({mediaTypes: ['images'], allowsEditing: false, exif: false}));
  expect(mocks.save).toHaveBeenCalledWith({avatar: 'data:image/jpeg;base64,selected-image-bytes'});
});
it('keeps the avatar unchanged when the user cancels selection', async () => {
  mocks.gallery.mockResolvedValue({canceled: true, assets: null});
  expect(await pickAvatar('gallery')).toBeNull();
  expect(mocks.manipulate).not.toHaveBeenCalled();
  expect(mocks.save).not.toHaveBeenCalled();
});
it('does not open the camera or save an avatar when camera permission is refused', async () => {
  mocks.cameraPermission.mockResolvedValue({granted: false});
  expect(await pickAvatar('camera')).toContain('cameră');
  expect(mocks.camera).not.toHaveBeenCalled();
  expect(mocks.save).not.toHaveBeenCalled();
});
