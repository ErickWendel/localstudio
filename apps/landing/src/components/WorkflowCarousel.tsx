import { useState } from 'react';
import { workflowSteps } from '../content/workflowSteps';
import { WorkflowPreview } from './WorkflowPreview';

type WorkflowStepId = (typeof workflowSteps)[number]['id'];

export function WorkflowCarousel({ prefersReducedMotion }: { prefersReducedMotion: boolean }) {
  const [activeWorkflowStep, setActiveWorkflowStep] = useState<WorkflowStepId>('prompt');
  const activeWorkflow = workflowSteps.find((step) => step.id === activeWorkflowStep) ?? workflowSteps[0];

  const advanceWorkflowStep = () => {
    if (prefersReducedMotion) {
      return;
    }

    setActiveWorkflowStep((currentStep) => {
      const currentIndex = workflowSteps.findIndex((step) => step.id === currentStep);
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % workflowSteps.length;
      return workflowSteps[nextIndex]!.id;
    });
  };

  return (
    <div id="workflow" className="workflow-carousel" aria-label="Feature workflow carousel">
      <div className="workflow-copy">
        <p className="eyebrow">Seamless workflow</p>
        <h2>{activeWorkflow.title}</h2>
        <p>{activeWorkflow.copy}</p>
      </div>
      <div className="workflow-tabs workflow-tabs--stair" role="tablist" aria-label="Choose workflow demo">
        {workflowSteps.map(({ id, icon: Icon, title }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeWorkflowStep === id}
            className={activeWorkflowStep === id ? 'workflow-tab active' : 'workflow-tab'}
            onClick={() => setActiveWorkflowStep(id)}
          >
            <Icon size={16} aria-hidden="true" />
            {title}
          </button>
        ))}
      </div>
      <WorkflowPreview
        activeStep={activeWorkflowStep}
        onDemoEnded={advanceWorkflowStep}
        prefersReducedMotion={prefersReducedMotion}
      />
    </div>
  );
}
