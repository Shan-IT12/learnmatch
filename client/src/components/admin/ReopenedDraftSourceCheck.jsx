import { useState } from 'react'
import SourceFirstDraftSources from './SourceFirstDraftSources'

// Parent keys this component by current content/revision: edits destroy transient results
// and abort requests without remounting the source editor or changing its inputs.
export default function ReopenedDraftSourceCheck({ sources, ...props }) {
  const [checks, setChecks] = useState(() => sources.map(source => ({ ...source, client_id: `saved-${source.source_id || 'new'}` })))
  return <SourceFirstDraftSources {...props} checkingOnly sources={checks} setSources={setChecks} />
}
