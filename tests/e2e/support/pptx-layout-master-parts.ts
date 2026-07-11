const masterRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdLayout1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rIdLayout2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout2.xml"/>
</Relationships>`;

const masterXml = `<?xml version="1.0" encoding="UTF-8"?>
<p:sldMaster xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld name="E2E Master"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
  <p:sldLayoutIdLst>
    <p:sldLayoutId id="1" r:id="rIdLayout1"/>
    <p:sldLayoutId id="2" r:id="rIdLayout2"/>
  </p:sldLayoutIdLst>
</p:sldMaster>`;

export const pptxLayoutMasterParts = [
  { path: 'ppt/slideMasters/slideMaster1.xml', contents: masterXml },
  { path: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', contents: masterRels },
] as const;
