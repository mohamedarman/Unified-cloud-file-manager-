import React from 'react';
import { ModalManagerState } from '../../hooks/useModalManager';
import { CommandPalette } from '../CommandPalette/CommandPalette';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { QuickLookModal } from './QuickLookModal';
import { FileDetailsModal } from './FileDetailsModal';
import { UploadModal } from './UploadModal';
import { AddAccountModal } from './AddAccountModal';
import { NewFolderModal } from './NewFolderModal';
import { RenameModal } from './RenameModal';
import { MoveModal } from './MoveModal';
import { RevisionsModal } from './RevisionsModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { MobileMoreDrawer } from '../MobileMoreDrawer';
import { OnboardingModal } from '../Onboarding/OnboardingModal';

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
    <>
      {/* Universal Command Palette (⌘K) */}
      {isCommandPaletteOpen && (
        <CommandPalette
          isOpen={true}
          onClose={closeCommandPalette}
          onOpenUpload={openUpload}
          onOpenNewFolder={openNewFolder}
          onOpenShortcuts={openShortcuts}
        />
      )}

      {/* Keyboard Shortcuts Cheatsheet Modal (?) */}
      {isShortcutsOpen && (
        <KeyboardShortcutsModal
          isOpen={true}
          onClose={closeShortcuts}
        />
      )}

      {/* Quick Look Spacebar Modal */}
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

      {/* File Details Drawer / Modal */}
      {inspectedFile && (
        <FileDetailsModal
          file={inspectedFile}
          onClose={() => setInspectedFile(null)}
          onOpenRename={(file) => setRenameTarget(file)}
          onOpenRevisions={(file) => setRevisionsTarget(file)}
          onOpenDeleteConfirm={(file) => setDeleteConfirmTarget(file)}
          onOpenMove={(file) => setMoveTarget(file)}
          onOpenQuickLook={(file) => {
            setInspectedFile(null);
            setQuickLookFile(file);
          }}
        />
      )}

      {/* Upload Modal */}
      {isUploadOpen && <UploadModal onClose={closeUpload} />}

      {/* Connect Account Modal */}
      {isAddAccountOpen && <AddAccountModal onClose={closeAddAccount} />}

      {/* New Folder Modal */}
      {isNewFolderOpen && <NewFolderModal onClose={closeNewFolder} />}

      {/* Rename Modal */}
      {renameTarget && (
        <RenameModal file={renameTarget} onClose={() => setRenameTarget(null)} />
      )}

      {/* Move Modal */}
      {moveTarget && (
        <MoveModal file={moveTarget} onClose={() => setMoveTarget(null)} />
      )}

      {/* Revisions History Modal */}
      {revisionsTarget && (
        <RevisionsModal file={revisionsTarget} onClose={() => setRevisionsTarget(null)} />
      )}

      {/* Delete Permanently Confirmation Modal */}
      {deleteConfirmTarget && (
        <DeleteConfirmModal
          file={deleteConfirmTarget}
          onClose={() => setDeleteConfirmTarget(null)}
        />
      )}

      {/* Mobile More Slide-Up Drawer */}
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

      {/* Onboarding Tour Modal */}
      {isTourOpen && <OnboardingModal onClose={closeTour} />}
    </>
  );
};
