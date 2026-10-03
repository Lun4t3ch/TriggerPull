// Expandable "How does this work?" guide for the upload-a-list option. Shown
// on the sign-in page and on the upload screen.
export default function UploadHelp() {
  return (
    <details className="help">
      <summary>How does this work?</summary>
      <ol>
        <li>Click <strong>Upload a list</strong> and choose your file (or drop it in).</li>
        <li>Check the preview. If needed, change the name column(s), swap first/last name with ⇄, or switch sheet.</li>
        <li>Click <strong>Continue</strong>, untick or remove anyone who shouldn’t be in the draw, then <strong>Start draw</strong>.</li>
      </ol>
      <p><strong>Files:</strong> Excel (.xlsx, .xls), .ods, CSV, TSV or plain text.</p>
      <p><strong>Layouts that work:</strong></p>
      <ul>
        <li>First and last name in separate columns, in either order</li>
        <li>Full name in one column — <em>John Smith</em> or <em>Smith, John</em></li>
        <li>One name per line in a text file</li>
      </ul>
      <p>
        A header row (<em>Name</em>, <em>First Name</em>, <em>Last Name</em>, <em>Surname</em>,
        <em> Competitor</em>…) helps but isn’t required. Other columns such as club, division,
        email or start number are ignored, and title, empty and total rows are skipped.
      </p>
    </details>
  );
}
