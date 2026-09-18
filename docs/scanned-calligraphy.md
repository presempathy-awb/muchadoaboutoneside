# Named poems and original handwriting

The poem editor, practice worksheet, and scale studio share a named poem library.
Canonical and Extended remain the first two entries and cannot be deleted. The
name field starts with the selected version's name. Save creates a new snapshot
only after a different, unique name is supplied; an invalid attempt focuses and
highlights the name field with an accessible explanation. Text may be unchanged
when saving under a new name. Working text uses Yjs and supports undo.

Named poems, private working drafts, and imported scans are saved in this
browser's IndexedDB. Scale study settings retain their existing browser draft.
A save is reported successful only after storage commits. Storage failures are
shown; this does not add account synchronization. Deleting a named poem also
removes its private working draft. It does not remove either original poem or a
handwriting face that another poem or study may use.

## Importing handwriting

Use **Scan import**, enter the new poem version name, and choose the calligrapher.
The editable calligrapher field starts with Jill Winters. Supply a PNG or JPEG
and its exact transcription, one typed line per handwritten line. Crop away
headings, row labels, and unrelated marks. Rotate a tilted page and adjust the
ink threshold as needed. The numbered overlay shows each region and its assigned
words. Review this against the original before saving.

The image is processed locally in a cancellable worker. No AI, OCR service, or
external image upload is used. Pixel projections locate lines and clear word
gaps. Cuts that would cross connected strokes are refused. When safe word gaps
do not agree with the transcription, a complete handwritten line remains one
indivisible region. Ambiguous line detection requires correcting the crop,
rotation, line breaks, or manual line dividers. Typed text supplies the labels;
the algorithm cannot prove that arbitrary cursive handwriting says those words.

Original image bytes and their SHA-256 digest are retained separately from the
transparent ink image. Input is limited to 12 MB, 24 million pixels, and 12,000
pixels on a side. The working image is uniformly reduced to at most four million
pixels and 4,096 pixels on a side. The scan library is bounded to 20 scans and
128 MiB of serialized data; browser quota may be lower. Import errors leave the
existing poem and displayed sculpture available.

## Using a scanned face

A reviewed scan is a face for its exact poem. Whitespace and line wrapping may
change; word order, capitalization, punctuation, and Unicode characters must
match. Every ink region carries a source word range, so repeated words retain
their individual handwritten shapes. Connected multiword regions remain intact
when fitting them onto plates. The layout uses measured ink dimensions and
uniform scaling; it does not generate missing letters or turn each repeated
letter into an identical glyph.

The scale studio prefers matching original calligraphy automatically. A saved
poem remembers the scan imported with it; the face selector also permits another
matching scan or an ordinary font. Geometry, safe margins, type size, and material
changes rerun the existing allocation and fit algorithms with the actual ink
measurements. If a whole region cannot fit at the minimum size, it remains
unplaced and the fit report says so. Enlarge the model, change the plates, reduce
the minimum size, or improve the segmentation instead of cutting through ink.

The continuous foil viewer offers the same matching scan choice and calculates
its live layout from the scan's dimensions. Browser previews do not regenerate
archived STL files, foil kits, outlined laser masters, or fabrication PDFs.
Original source assets and the public reference gallery remain unchanged. Jill's
existing gallery photograph contains different writing and is not used as a face
for the sculpture poem.

Download the handwriting JSON backup after importing. Exporting a scale study
with a selected matching scan also embeds its original image and mapping;
importing that study verifies and restores the scan before applying its settings.
These files can contain substantial image data and the entered poem and credit.
The **Saved handwriting** panel can download backups, remove a local face after
confirmation, or restore a backup with its original face ID. Restoring reconnects
existing studies without creating another poem. Removing a face keeps its poem
text versions; studies referencing it need a restored backup or another face.

## Algorithm references

The implementation uses small TypeScript pixel operations with no additional
image-processing dependency. The underlying operations are described in the
[OpenCV thresholding documentation](https://docs.opencv.org/4.13.0/d7/d4d/tutorial_py_thresholding.html)
and [connected-component documentation](https://docs.opencv.org/4.13.0/d3/dc0/group__imgproc__shape.html).
Browser decoding and canvas behavior follow the
[HTML image-bitmap standard](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html).
Analysis is deterministic for the same normalized pixel buffer and settings;
browser decoding, color handling, and resampling can differ, so the accepted ink
image and mapping are saved together rather than recomputed on every visit.
