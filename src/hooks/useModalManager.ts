import { useState, useCallback, useMemo } from 'react';
import { CloudFile } from '../types';

export interface ModalManagerState {
  // Boolean visibility states
  isUploadOpen: boolean;
  isAddAccountOpen: boolean;
  isNewFolderOpen: boolean;
  isCommandPaletteOpen: boolean;
  isShortcutsOpen: boolean;
  isTourOpen: boolean;
  isMoreDrawerOpen: boolean;

  // Active resource targets
  inspectedFile: CloudFile | null;
  quickLookFile: CloudFile | null;
  renameTarget: CloudFile | null;
  moveTarget: CloudFile | null;
  revisionsTarget: CloudFile | null;
  deleteConfirmTarget: CloudFile | null;

  // Open/Close actions
  openUpload: () => void;
  closeUpload: () => void;
  openAddAccount: () => void;
  closeAddAccount: () => void;
  openNewFolder: () => void;
  closeNewFolder: () => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;
  openShortcuts: () => void;
  closeShortcuts: () => void;
  openTour: () => void;
  closeTour: () => void;
  openMoreDrawer: () => void;
  closeMoreDrawer: () => void;

  // Target setters
  setInspectedFile: (file: CloudFile | null) => void;
  setQuickLookFile: (file: CloudFile | null) => void;
  setRenameTarget: (file: CloudFile | null) => void;
  setMoveTarget: (file: CloudFile | null) => void;
  setRevisionsTarget: (file: CloudFile | null) => void;
  setDeleteConfirmTarget: (file: CloudFile | null) => void;
  closeAllModals: () => void;
}

export function useModalManager(): ModalManagerState {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isMoreDrawerOpen, setIsMoreDrawerOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(() => {
    return !localStorage.getItem('ucfm_onboarding_completed');
  });

  const [inspectedFile, setInspectedFile] = useState<CloudFile | null>(null);
  const [quickLookFile, setQuickLookFile] = useState<CloudFile | null>(null);
  const [renameTarget, setRenameTarget] = useState<CloudFile | null>(null);
  const [moveTarget, setMoveTarget] = useState<CloudFile | null>(null);
  const [revisionsTarget, setRevisionsTarget] = useState<CloudFile | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<CloudFile | null>(null);

  const openUpload = useCallback(() => setIsUploadOpen(true), []);
  const closeUpload = useCallback(() => setIsUploadOpen(false), []);

  const openAddAccount = useCallback(() => setIsAddAccountOpen(true), []);
  const closeAddAccount = useCallback(() => setIsAddAccountOpen(false), []);

  const openNewFolder = useCallback(() => setIsNewFolderOpen(true), []);
  const closeNewFolder = useCallback(() => setIsNewFolderOpen(false), []);

  const openCommandPalette = useCallback(() => setIsCommandPaletteOpen(true), []);
  const closeCommandPalette = useCallback(() => setIsCommandPaletteOpen(false), []);
  const toggleCommandPalette = useCallback(() => setIsCommandPaletteOpen((prev) => !prev), []);

  const openShortcuts = useCallback(() => setIsShortcutsOpen(true), []);
  const closeShortcuts = useCallback(() => setIsShortcutsOpen(false), []);

  const openTour = useCallback(() => setIsTourOpen(true), []);
  const closeTour = useCallback(() => setIsTourOpen(false), []);

  const openMoreDrawer = useCallback(() => setIsMoreDrawerOpen(true), []);
  const closeMoreDrawer = useCallback(() => setIsMoreDrawerOpen(false), []);

  const closeAllModals = useCallback(() => {
    setIsUploadOpen(false);
    setIsAddAccountOpen(false);
    setIsNewFolderOpen(false);
    setIsCommandPaletteOpen(false);
    setIsShortcutsOpen(false);
    setIsMoreDrawerOpen(false);
    setIsTourOpen(false);
    setInspectedFile(null);
    setQuickLookFile(null);
    setRenameTarget(null);
    setMoveTarget(null);
    setRevisionsTarget(null);
    setDeleteConfirmTarget(null);
  }, []);

  return useMemo(
    () => ({
      isUploadOpen,
      isAddAccountOpen,
      isNewFolderOpen,
      isCommandPaletteOpen,
      isShortcutsOpen,
      isTourOpen,
      isMoreDrawerOpen,
      inspectedFile,
      quickLookFile,
      renameTarget,
      moveTarget,
      revisionsTarget,
      deleteConfirmTarget,
      openUpload,
      closeUpload,
      openAddAccount,
      closeAddAccount,
      openNewFolder,
      closeNewFolder,
      openCommandPalette,
      closeCommandPalette,
      toggleCommandPalette,
      openShortcuts,
      closeShortcuts,
      openTour,
      closeTour,
      openMoreDrawer,
      closeMoreDrawer,
      setInspectedFile,
      setQuickLookFile,
      setRenameTarget,
      setMoveTarget,
      setRevisionsTarget,
      setDeleteConfirmTarget,
      closeAllModals,
    }),
    [
      isUploadOpen,
      isAddAccountOpen,
      isNewFolderOpen,
      isCommandPaletteOpen,
      isShortcutsOpen,
      isTourOpen,
      isMoreDrawerOpen,
      inspectedFile,
      quickLookFile,
      renameTarget,
      moveTarget,
      revisionsTarget,
      deleteConfirmTarget,
      openUpload,
      closeUpload,
      openAddAccount,
      closeAddAccount,
      openNewFolder,
      closeNewFolder,
      openCommandPalette,
      closeCommandPalette,
      toggleCommandPalette,
      openShortcuts,
      closeShortcuts,
      openTour,
      closeTour,
      openMoreDrawer,
      closeMoreDrawer,
      closeAllModals,
    ]
  );
}
