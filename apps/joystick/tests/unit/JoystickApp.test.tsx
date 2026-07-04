import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JoystickApp } from '../../src/app/JoystickApp';
import { InMemoryPresenterRemoteSignalingService } from '@localstudio/presenter-remote/signaling-service';

const streamReceiverMock = vi.hoisted(() => ({
  create: vi.fn(
    (options: {
      onStatusChange: (status: 'connected') => void;
      onStream: (stream: MediaStream | undefined) => void;
    }) => ({
      sendStreamPreference: vi.fn(() => true),
      start: vi.fn(() => {
        options.onStream({} as MediaStream);
        options.onStatusChange('connected');
      }),
      stop: vi.fn(),
    }),
  ),
}));

vi.mock('../../src/app/presenterRemoteStreamReceiver', () => ({
  presenterRemoteStreamReceiver: streamReceiverMock,
}));

describe('JoystickApp', () => {
  beforeEach(() => {
    window.localStorage.clear();
    streamReceiverMock.create.mockClear();
  });

  it('renders the installable remote shell and starts with the query code', async () => {
    const service = new InMemoryPresenterRemoteSignalingService({
      randomCode: () => 'ABCD-1234',
      randomId: () => 'session-1',
    });
    service.registerSession({ presenterLabel: 'MacBook Pro', ttlMs: 60_000 });

    render(
      <JoystickApp
        initialUrl="https://localstudio.test/joystick?code=abcd-1234"
        signalingService={service}
      />,
    );

    expect(await screen.findByLabelText('Presentation remote control')).toBeInTheDocument();
    expect(screen.getByLabelText('Connected (1)')).toBeInTheDocument();
  });

  it('renders when browser storage is unavailable', async () => {
    const originalLocalStorage = window.localStorage;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: undefined,
    });
    const service = new InMemoryPresenterRemoteSignalingService({
      randomCode: () => 'ABCD-1234',
      randomId: () => 'session-1',
    });
    service.registerSession({ presenterLabel: 'MacBook Pro', ttlMs: 60_000 });

    try {
      render(
        <JoystickApp
          initialUrl="https://localstudio.test/joystick?code=abcd-1234"
          signalingService={service}
        />,
      );

      expect(await screen.findByLabelText('Presentation remote control')).toBeInTheDocument();
      expect(screen.getByLabelText('Connected (1)')).toBeInTheDocument();
    } finally {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: originalLocalStorage,
      });
    }
  });

  it('uses the remembered code when the app opens without a query code', async () => {
    const service = new InMemoryPresenterRemoteSignalingService({
      randomCode: () => 'ABCD-1234',
      randomId: () => 'session-1',
    });
    service.registerSession({ presenterLabel: 'MacBook Pro', ttlMs: 60_000 });
    service.publishState('ABCD-1234', {
      activePageId: 'page-1',
      activePageIndex: 0,
      buildsRemaining: 0,
      connectedControllerCount: 1,
      deckName: 'Launch Deck',
      notes: '',
      pageCount: 1,
      presenterMode: 'presenting',
      shortcuts: ['previous', 'next'],
      timer: { elapsedMs: 0, paused: false },
      type: 'state',
    });
    window.localStorage.setItem('localstudio.joystick.lastCode', 'ABCD-1234');

    render(
      <JoystickApp initialUrl="https://localstudio.test/joystick" signalingService={service} />,
    );

    expect(await screen.findByText('Current: Slide 1 of 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Slide position')).toHaveTextContent('1 / 1');
  });

  it('requires a code even when one presentation is active if the phone is not paired', async () => {
    const service = new InMemoryPresenterRemoteSignalingService({
      randomCode: () => 'ABCD-1234',
      randomId: () => 'session-1',
    });
    service.registerSession({ presenterLabel: 'MacBook Pro', ttlMs: 60_000 });

    render(
      <JoystickApp initialUrl="https://localstudio.test/joystick" signalingService={service} />,
    );

    expect(
      await screen.findByText('Enter the code shown on the presenter screen.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('MacBook Pro')).not.toBeInTheDocument();
  });

  it('requires a code when multiple presentations are active', async () => {
    const codes = ['ABCD-1234', 'EFGH-5678'];
    const ids = ['session-1', 'session-2'];
    const service = new InMemoryPresenterRemoteSignalingService({
      randomCode: () => codes.shift() ?? 'JKLM-9012',
      randomId: () => ids.shift() ?? 'session-3',
    });
    service.registerSession({ presenterLabel: 'MacBook Pro', ttlMs: 60_000 });
    service.registerSession({ presenterLabel: 'Studio Display', ttlMs: 60_000 });

    render(
      <JoystickApp initialUrl="https://localstudio.test/joystick" signalingService={service} />,
    );

    expect(
      await screen.findByText('Enter the code shown on the presenter screen.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('MacBook Pro')).not.toBeInTheDocument();
  });

  it('sends slide jump commands from the slide preview after a session is selected', async () => {
    const user = userEvent.setup();
    const service = new InMemoryPresenterRemoteSignalingService({
      randomCode: () => 'ABCD-1234',
      randomId: () => 'session-1',
    });
    service.registerSession({ presenterLabel: 'MacBook Pro', ttlMs: 60_000 });
    service.publishState('ABCD-1234', {
      activePageId: 'page-1',
      activePageIndex: 0,
      buildsRemaining: 0,
      connectedControllerCount: 1,
      deckName: 'Launch Deck',
      notes: '',
      pageCount: 2,
      pages: [
        { id: 'page-1', name: 'Intro' },
        { id: 'page-2', name: 'Roadmap' },
      ],
      presenterMode: 'presenting',
      shortcuts: ['previous', 'next'],
      timer: { elapsedMs: 0, paused: false },
      type: 'state',
    });

    render(
      <JoystickApp
        initialUrl="https://localstudio.test/joystick?code=ABCD-1234"
        signalingService={service}
      />,
    );

    const preview = await screen.findByRole('button', { name: 'Current slide preview' });
    await user.click(preview);

    expect(screen.getByText('Command sent: go-to-page')).toBeInTheDocument();
    expect(service.takeCommands('ABCD-1234')).toEqual([
      { command: 'go-to-page', pageId: 'page-2', type: 'command' },
    ]);
  });

  it('sends slide jump commands from the streamed presenter preview', async () => {
    const user = userEvent.setup();
    const service = new InMemoryPresenterRemoteSignalingService({
      randomCode: () => 'ABCD-1234',
      randomId: () => 'session-1',
    });
    service.registerSession({ presenterLabel: 'MacBook Pro', ttlMs: 60_000 });
    service.publishState('ABCD-1234', {
      activePageId: 'page-1',
      activePageIndex: 0,
      buildsRemaining: 0,
      connectedControllerCount: 1,
      deckName: 'Launch Deck',
      notes: '',
      pageCount: 2,
      pages: [
        { id: 'page-1', name: 'Intro' },
        { id: 'page-2', name: 'Roadmap' },
      ],
      presenterMode: 'presenting',
      previewMode: 'stream',
      shortcuts: ['previous', 'next'],
      stream: { enabled: true, fps: 8, height: 340, width: 390 },
      timer: { elapsedMs: 0, paused: false },
      type: 'state',
    });

    render(
      <JoystickApp
        initialUrl="https://localstudio.test/joystick?code=ABCD-1234"
        signalingService={service}
      />,
    );

    const preview = await screen.findByRole('button', { name: 'Presenter stream preview' });
    await user.click(preview);

    expect(service.takeCommands('ABCD-1234')).toEqual([
      { command: 'go-to-page', pageId: 'page-2', type: 'command' },
    ]);
  });

  it('sends slide jump commands from horizontal swipes on the slide preview', async () => {
    const service = new InMemoryPresenterRemoteSignalingService({
      randomCode: () => 'ABCD-1234',
      randomId: () => 'session-1',
    });
    service.registerSession({ presenterLabel: 'MacBook Pro', ttlMs: 60_000 });
    service.publishState('ABCD-1234', {
      activePageId: 'page-2',
      activePageIndex: 1,
      buildsRemaining: 0,
      connectedControllerCount: 1,
      deckName: 'Launch Deck',
      notes: '',
      pageCount: 3,
      pages: [
        { id: 'page-1', name: 'Intro' },
        { id: 'page-2', name: 'Roadmap' },
        { id: 'page-3', name: 'Budget' },
      ],
      presenterMode: 'presenting',
      shortcuts: ['previous', 'next'],
      timer: { elapsedMs: 0, paused: false },
      type: 'state',
    });

    render(
      <JoystickApp
        initialUrl="https://localstudio.test/joystick?code=ABCD-1234"
        signalingService={service}
      />,
    );

    const preview = await screen.findByRole('button', { name: 'Current slide preview' });
    await waitFor(() => expect(screen.getByLabelText('Slide position')).toHaveTextContent('2 / 3'));
    fireEvent.touchStart(preview, { changedTouches: [{ clientX: 260 }] });
    fireEvent.touchEnd(preview, { changedTouches: [{ clientX: 120 }] });

    expect(service.takeCommands('ABCD-1234')).toEqual([
      { command: 'go-to-page', pageId: 'page-3', type: 'command' },
    ]);
  });

  it('toggles timer commands from the presenter timer state', async () => {
    const user = userEvent.setup();
    const service = new InMemoryPresenterRemoteSignalingService({
      randomCode: () => 'ABCD-1234',
      randomId: () => 'session-1',
    });
    service.registerSession({ presenterLabel: 'MacBook Pro', ttlMs: 60_000 });
    service.publishState('ABCD-1234', {
      activePageId: 'page-1',
      activePageIndex: 0,
      buildsRemaining: 0,
      connectedControllerCount: 1,
      deckName: 'Launch Deck',
      notes: '',
      pageCount: 1,
      presenterMode: 'presenting',
      shortcuts: ['pause-timer', 'reset-timer'],
      timer: { elapsedMs: 79_000, paused: true },
      type: 'state',
    });

    render(
      <JoystickApp
        initialUrl="https://localstudio.test/joystick?code=ABCD-1234"
        signalingService={service}
      />,
    );

    await waitFor(() =>
      expect(screen.getByLabelText('Presentation timer')).toHaveTextContent('01:19'),
    );
    await user.click(screen.getByRole('button', { name: 'Resume timer' }));
    await user.click(screen.getByRole('button', { name: 'Reset timer' }));

    expect(service.takeCommands('ABCD-1234')).toEqual([
      { command: 'resume-timer', type: 'command' },
      { command: 'reset-timer', type: 'command' },
    ]);
  });

  it('formats the phone timer with hours after sixty minutes', async () => {
    const service = new InMemoryPresenterRemoteSignalingService({
      randomCode: () => 'ABCD-1234',
      randomId: () => 'session-1',
    });
    service.registerSession({ presenterLabel: 'MacBook Pro', ttlMs: 60_000 });
    service.publishState('ABCD-1234', {
      activePageId: 'page-1',
      activePageIndex: 0,
      buildsRemaining: 0,
      connectedControllerCount: 1,
      deckName: 'Launch Deck',
      notes: '',
      pageCount: 1,
      presenterMode: 'presenting',
      shortcuts: ['pause-timer', 'reset-timer'],
      timer: { elapsedMs: 3_721_000, paused: true },
      type: 'state',
    });

    render(
      <JoystickApp
        initialUrl="https://localstudio.test/joystick?code=ABCD-1234"
        signalingService={service}
      />,
    );

    await waitFor(() =>
      expect(screen.getByLabelText('Presentation timer')).toHaveTextContent('01:02:01'),
    );
  });

  it('advances active timers from the presenter update timestamp instead of poll time', async () => {
    const service = new InMemoryPresenterRemoteSignalingService({
      randomCode: () => 'ABCD-1234',
      randomId: () => 'session-1',
    });
    service.registerSession({ presenterLabel: 'MacBook Pro', ttlMs: 60_000 });
    service.publishState('ABCD-1234', {
      activePageId: 'page-1',
      activePageIndex: 0,
      buildsRemaining: 0,
      connectedControllerCount: 1,
      deckName: 'Launch Deck',
      notes: '',
      pageCount: 1,
      presenterMode: 'presenting',
      shortcuts: ['pause-timer', 'reset-timer'],
      timer: { elapsedMs: 10_000, paused: false, updatedAtEpochMs: Date.now() - 50_000 },
      type: 'state',
    });

    render(
      <JoystickApp
        initialUrl="https://localstudio.test/joystick?code=ABCD-1234"
        signalingService={service}
      />,
    );

    await waitFor(() =>
      expect(screen.getByLabelText('Presentation timer')).toHaveTextContent('01:00'),
    );
  });

  it('renders published presenter state for slide status and notes', async () => {
    const service = new InMemoryPresenterRemoteSignalingService({
      randomCode: () => 'ABCD-1234',
      randomId: () => 'session-1',
    });
    service.registerSession({ presenterLabel: 'MacBook Pro', ttlMs: 60_000 });
    service.publishState('ABCD-1234', {
      activePageId: 'page-2',
      activePageIndex: 1,
      activePageName: 'Roadmap',
      buildsRemaining: 2,
      connectedControllerCount: 1,
      deckName: 'Launch Deck',
      notes: 'Talk through the launch timeline.',
      pageCount: 5,
      pages: [
        { id: 'page-1', name: 'Intro' },
        { id: 'page-2', name: 'Roadmap' },
        { id: 'page-3', name: 'Budget' },
      ],
      presenterMode: 'presenting',
      slidePreview: {
        backgroundColor: '#050D10',
        elements: [
          {
            align: 'center',
            fill: '#FFFFFF',
            fontFamily: 'Open Sans',
            fontSize: 96,
            fontWeight: 800,
            height: 120,
            id: 'title',
            kind: 'text',
            opacity: 1,
            rotation: 0,
            text: 'Launch timeline',
            width: 1200,
            x: 240,
            y: 360,
          },
          {
            assetUrl: 'https://cdn.localstudio.test/demo.mp4',
            autoplay: true,
            controls: true,
            height: 300,
            id: 'video-1',
            kind: 'media',
            loop: true,
            mediaType: 'video',
            muted: true,
            opacity: 1,
            rotation: 0,
            width: 520,
            x: 200,
            y: 620,
          },
        ],
        height: 1080,
        width: 1920,
      },
      shortcuts: ['previous', 'next'],
      timer: { elapsedMs: 0, paused: false },
      type: 'state',
      upcomingSlidePreviews: [
        {
          pageId: 'page-3',
          pageName: 'Budget',
          preview: {
            backgroundColor: '#111111',
            elements: [],
            height: 1080,
            width: 1920,
          },
        },
        {
          pageId: 'page-4',
          pageName: 'Demo',
          preview: {
            backgroundColor: '#222222',
            elements: [],
            height: 1080,
            width: 1920,
          },
        },
        {
          pageId: 'page-5',
          pageName: 'Close',
          preview: {
            backgroundColor: '#333333',
            elements: [],
            height: 1080,
            width: 1920,
          },
        },
      ],
    });

    render(
      <JoystickApp
        initialUrl="https://localstudio.test/joystick?code=ABCD-1234"
        signalingService={service}
      />,
    );

    expect(await screen.findByText('Current: Slide 2 of 5')).toBeInTheDocument();
    expect(screen.getByText('Current: Slide 2 of 5')).toBeInTheDocument();
    expect(screen.getByText('Builds remaining: 2')).toBeInTheDocument();
    expect(screen.getByText('Launch timeline')).toBeInTheDocument();
    expect(screen.getByLabelText('Slide video')).toHaveAttribute(
      'src',
      'https://cdn.localstudio.test/demo.mp4',
    );
    expect(
      screen.getByRole('button', { name: 'Go to upcoming slide 1: Budget' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Go to upcoming slide 2: Demo' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Go to upcoming slide 3: Close' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Slide position')).toHaveTextContent('2 / 5');
    expect(screen.getByText('Talk through the launch timeline.')).toBeInTheDocument();
  });

  it('sends slide jump commands from upcoming mobile thumbnails', async () => {
    const user = userEvent.setup();
    const service = new InMemoryPresenterRemoteSignalingService({
      randomCode: () => 'ABCD-1234',
      randomId: () => 'session-1',
    });
    service.registerSession({ presenterLabel: 'MacBook Pro', ttlMs: 60_000 });
    service.publishState('ABCD-1234', {
      activePageId: 'page-1',
      activePageIndex: 0,
      buildsRemaining: 0,
      connectedControllerCount: 1,
      deckName: 'Launch Deck',
      notes: '',
      pageCount: 4,
      presenterMode: 'presenting',
      shortcuts: ['previous', 'next'],
      timer: { elapsedMs: 0, paused: false },
      type: 'state',
      upcomingSlidePreviews: [
        {
          pageId: 'page-2',
          pageName: 'Roadmap',
          preview: {
            backgroundColor: '#111111',
            elements: [],
            height: 1080,
            width: 1920,
          },
        },
        {
          pageId: 'page-3',
          pageName: 'Budget',
          preview: {
            backgroundColor: '#222222',
            elements: [],
            height: 1080,
            width: 1920,
          },
        },
        {
          pageId: 'page-4',
          pageName: 'Close',
          preview: {
            backgroundColor: '#333333',
            elements: [],
            height: 1080,
            width: 1920,
          },
        },
      ],
    });

    render(
      <JoystickApp
        initialUrl="https://localstudio.test/joystick?code=ABCD-1234"
        signalingService={service}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'Go to upcoming slide 3: Close' }));

    expect(service.takeCommands('ABCD-1234')).toEqual([
      { command: 'go-to-page', pageId: 'page-4', type: 'command' },
    ]);
  });

  it('opens slide navigation and sends a go-to-page command', async () => {
    const user = userEvent.setup();
    const service = new InMemoryPresenterRemoteSignalingService({
      randomCode: () => 'ABCD-1234',
      randomId: () => 'session-1',
    });
    service.registerSession({ presenterLabel: 'MacBook Pro', ttlMs: 60_000 });
    service.publishState('ABCD-1234', {
      activePageId: 'page-1',
      activePageIndex: 0,
      buildsRemaining: 0,
      connectedControllerCount: 1,
      deckName: 'Launch Deck',
      notes: '',
      pageCount: 3,
      pages: [
        {
          id: 'page-1',
          name: 'Intro',
          preview: {
            backgroundColor: '#111111',
            elements: [],
            height: 1080,
            width: 1920,
          },
        },
        {
          id: 'page-2',
          name: 'Roadmap',
          preview: {
            backgroundColor: '#222222',
            elements: [],
            height: 1080,
            width: 1920,
          },
        },
        {
          id: 'page-3',
          name: 'Budget',
          preview: {
            backgroundColor: '#333333',
            elements: [],
            height: 1080,
            width: 1920,
          },
        },
      ],
      presenterMode: 'presenting',
      shortcuts: ['previous', 'next'],
      timer: { elapsedMs: 0, paused: false },
      type: 'state',
    });

    const { container } = render(
      <JoystickApp
        initialUrl="https://localstudio.test/joystick?code=ABCD-1234"
        signalingService={service}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'Show slide navigation' }));
    expect(
      container.querySelectorAll('.joystick-slide-navigator-thumb .joystick-slide-canvas'),
    ).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Go to slide 3: Budget' }));

    expect(service.takeCommands('ABCD-1234')).toEqual([
      { command: 'go-to-page', pageId: 'page-3', type: 'command' },
    ]);
  });

  it('zooms presenter notes on the phone', async () => {
    const user = userEvent.setup();
    const service = new InMemoryPresenterRemoteSignalingService({
      randomCode: () => 'ABCD-1234',
      randomId: () => 'session-1',
    });
    service.registerSession({ presenterLabel: 'MacBook Pro', ttlMs: 60_000 });
    service.publishState('ABCD-1234', {
      activePageId: 'page-1',
      activePageIndex: 0,
      buildsRemaining: 0,
      connectedControllerCount: 1,
      deckName: 'Launch Deck',
      notes: 'Make the notes readable from a phone.',
      pageCount: 1,
      presenterMode: 'presenting',
      shortcuts: ['previous', 'next'],
      timer: { elapsedMs: 0, paused: false },
      type: 'state',
    });

    render(
      <JoystickApp
        initialUrl="https://localstudio.test/joystick?code=ABCD-1234"
        signalingService={service}
      />,
    );

    const notes = await screen.findByLabelText('Presenter notes content');
    expect(notes).toHaveStyle({ fontSize: '28px' });
    await user.click(screen.getByRole('button', { name: 'Increase notes size' }));
    expect(notes).toHaveStyle({ fontSize: '31px' });
    await user.click(screen.getByRole('button', { name: 'Decrease notes size' }));
    expect(notes).toHaveStyle({ fontSize: '28px' });
  });

  it('asks the desktop to enter presenter mode before showing controls', async () => {
    const service = new InMemoryPresenterRemoteSignalingService({
      randomCode: () => 'ABCD-1234',
      randomId: () => 'session-1',
    });
    service.registerSession({ presenterLabel: 'MacBook Pro', ttlMs: 60_000 });
    service.publishState('ABCD-1234', {
      activePageId: 'page-1',
      activePageIndex: 0,
      buildsRemaining: 0,
      connectedControllerCount: 1,
      deckName: 'Launch Deck',
      notes: '',
      pageCount: 1,
      presenterMode: 'ready',
      shortcuts: ['start-presenting'],
      timer: { elapsedMs: 0, paused: false },
      type: 'state',
    });

    render(
      <JoystickApp
        initialUrl="https://localstudio.test/joystick?code=ABCD-1234"
        signalingService={service}
      />,
    );

    expect(await screen.findByLabelText('Presenter mode required')).toBeInTheDocument();
    expect(screen.getByText(/Open presenter mode on/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start presenter mode' })).not.toBeInTheDocument();

    expect(service.takeCommands('ABCD-1234')).toEqual([]);
  });
});
