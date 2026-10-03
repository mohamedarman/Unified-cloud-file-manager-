import React, { Suspense, lazy } from 'react';
import { ModalManagerState } from '../../hooks/useModalManager';

// Lazy-loaded modal components for maximum initial load performance
const CommandPalette = lazy(() =>
  import('../CommandPalette/CommandPalette').then((m) => ({ default: m.CommandPalette }))
);
const KeyboardShortcutsModal = lazy(() =>
  import('./KeyboardShortcutsModal').then((m) => ({ default: m.KeyboardShortcutsModal }))
);
const QuickLookModal = lazy(() =>
  import('./QuickLookModal').then((m) => ({ default: m.QuickLookModal }))
);
const FileDetailsModal = lazy(() =>
  import('./FileDetailsModal').then((m) => ({ default: m.FileDetailsModal }))
);
const UploadModal = lazy(() =>
  import('./UploadModal').then((m) => ({ default: m.UploadModal }))
);
const AddAccountModal = lazy(() =>
  import('./AddAccountModal').then((m) => ({ default: m.AddAccountModal }))
);
const NewFolderModal = lazy(() =>
  import('./NewFolderModal').then((m) => ({ default: m.NewFolderModal }))
);
const RenameModal = lazy(() =>
  import('./RenameModal').then((m) => ({ default: m.RenameModal }))
);
const MoveModal = lazy(() =>
  import('./MoveModal').then((m) => ({ default: m.MoveModal }))
);
const RevisionsModal = lazy(() =>
  import('./RevisionsModal').then((m) => ({ default: m.RevisionsModal }))
);
const DeleteConfirmModal = lazy(() =>
  import('./DeleteConfirmModal').then((m) => ({ default: m.DeleteConfirmModal }))
);
const MobileMoreDrawer = lazy(() =>
  import('../MobileMoreDrawer').then((m) => ({ default: m.MobileMoreDrawer }))
);
const OnboardingModal = lazy(() =>
  import('../Onboarding/OnboardingModal').then((m) => ({ default: m.OnboardingModal }))
);

interface ModalContainerProps {
  modalManager: ModalManagerState;
}

export const ModalContainer: React.FC<ModalContainerProps> = ({ modalManager }) => {
  const {
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
    openNewFolder,
    closeAddAccount,
    closeNewFolder,
    closeCommandPalette,
    openShortcuts,
    closeShortcuts,
    closeTour,
    closeMoreDrawer,
    openAddAccount,
    setInspectedFile,
    setQuickLookFile,
    setRenameTarget,
    setMoveTarget,
    setRevisionsTarget,
    setDeleteConfirmTarget,
  } = modalManager;

  return (
    <Suspense fallback={null}>
      {/* Universal Command Palette (⌘K) - Lazy Loaded */}
      {isCommandPaletteOpen && (
        <CommandPalette
          isOpen={true}
          onClose={closeCommandPalette}
          onOpenUpload={openUpload}
          onOpenNewFolder={openNewFolder}
          onOpenShortcuts={openShortcuts}
        />
      )}

      {/* Keyboard Shortcuts Cheatsheet Modal (?) - Lazy Loaded */}
      {isShortcutsOpen && (
        <KeyboardShortcutsModal
          isOpen={true}
          onClose={closeShortcuts}
        />
      )}

      {/* Quick Look Spacebar Modal - Lazy Loaded */}
      {quickLookFile && (
        <QuickLookModal
          file={quickLookFile}
          onClose={() => setQuickLookFile(null)}
          onOpenDetails={(file) => {
            setQuickLookFile(null);
            setInspectedFile(file);
          }}
        />
      )}

      {/* File Details Drawer / Modal - Lazy Loaded */}
      {inspectedFile && (
        <FileDetailsModal
          file={inspectedFile}
          onClose={() => setInspectedFile(null)}
          onOpenRename={(file) => setRenameTarget(file)}
          onOpenRevisions={(file) => setRevisionsTarget(file)}
          onOpenDeleteConfirm={(file) => setDeleteConfirmTarget(file)}
          onOpenMove={(file) => setMoveTarget(file)}
        />
      )}

      {/* Upload Modal - Lazy Loaded */}
      {isUploadOpen && <UploadModal onClose={closeUpload} />}

      {/* Connect Account Modal - Lazy Loaded */}
      {isAddAccountOpen && <AddAccountModal onClose={closeAddAccount} />}

      {/* New Folder Modal - Lazy Loaded */}
      {isNewFolderOpen && <NewFolderModal onClose={closeNewFolder} />}

      {/* Rename Modal - Lazy Loaded */}
      {renameTarget && (
        <RenameModal file={renameTarget} onClose={() => setRenameTarget(null)} />
      )}

      {/* Move Modal - Lazy Loaded */}
      {moveTarget && (
        <MoveModal file={moveTarget} onClose={() => setMoveTarget(null)} />
      )}

      {/* Revisions History Modal - Lazy Loaded */}
      {revisionsTarget && (
        <RevisionsModal file={revisionsTarget} onClose={() => setRevisionsTarget(null)} />
      )}

      {/* Delete Permanently Confirmation Modal - Lazy Loaded */}
      {deleteConfirmTarget && (
        <DeleteConfirmModal
          file={deleteConfirmTarget}
          onClose={() => setDeleteConfirmTarget(null)}
        />
      )}

      {/* Mobile More Slide-Up Drawer - Lazy Loaded */}
      {isMoreDrawerOpen && (
        <MobileMoreDrawer
          isOpen={true}
          onClose={closeMoreDrawer}
          onOpenAddAccount={() => {
            closeMoreDrawer();
            openAddAccount();
          }}
        />
      )}

      {/* Onboarding Tour Modal - Lazy Loaded */}
      {isTourOpen && <OnboardingModal onClose={closeTour} />}
    </Suspense>
  );
};
