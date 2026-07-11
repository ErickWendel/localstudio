import type {
  PageBackground,
  ProjectDocument,
  SlideLayout,
} from '../../../../domain/documents/model';

export interface SlideLayoutChooserProps {
  activeLayoutId?: string | undefined;
  layouts: SlideLayout[];
  pageId?: string | undefined;
  onApplySlideLayout: (pageId: string, layoutId: string) => void;
}

export interface SlideDesignBackgroundControlsProps {
  background: PageBackground | undefined;
  onUpdatePageBackground: ((background: PageBackground) => void) | undefined;
}

export interface SlideDesignPanelProps {
  page?: ProjectDocument['pages'][number] | undefined;
  project: ProjectDocument;
  onApplySlideLayout: ((pageId: string, layoutId: string) => void) | undefined;
  onEditSlideLayout: ((layoutId: string) => void) | undefined;
  onToggleSlideLayoutPlaceholder:
    | ((
        layoutId: string,
        role: 'body' | 'footer' | 'slideNumber' | 'title',
        visible: boolean,
      ) => void)
    | undefined;
  onUpdatePageBackground: ((background: PageBackground) => void) | undefined;
}
