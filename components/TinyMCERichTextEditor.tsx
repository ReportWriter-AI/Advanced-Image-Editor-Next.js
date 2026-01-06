import React, { forwardRef, useImperativeHandle, useMemo } from 'react';
import { Editor } from '@tinymce/tinymce-react';

export type PlaceholderItem = {
	token: string;
	description: string;
	input?: boolean;
	required?: boolean;
};

export type PlaceholderSection = {
	title: string;
	placeholders: PlaceholderItem[];
};

interface TinyMCERichTextEditorProps {
	value?: string;
	onChange?: (value: string) => void;
	initialValue?: string;
	placeholderSections?: PlaceholderSection[];
	enablePlaceholders?: boolean;
	plugins?: string[];
	toolbar?: string;
	height?: number;
}

export interface TinyMCERichTextEditorRef {
	getEditor: () => any | null;
}

// Helper function to convert PLACEHOLDER_SECTIONS to TinyMCE mergetags_list format
const convertPlaceholdersToMergeTagsList = (sections?: PlaceholderSection[]) => {
	if (!sections || sections.length === 0) {
		return [];
	}

	return sections.map((section) => {
		const mergeTagItems = section.placeholders
			.filter((p) => !p.input)
			.map((placeholder) => {
				const tokenValue = placeholder.token.replace(/^\[|\]$/g, '');
				return {
					value: tokenValue,
					title: placeholder.description || tokenValue,
				};
			});

		if (mergeTagItems.length === 0) {
			return null;
		}

		return {
			title: section.title,
			menu: mergeTagItems,
		};
	}).filter((item): item is { title: string; menu: Array<{ value: string; title: string }> } => item !== null);
};

// Default plugins array
const DEFAULT_PLUGINS = [
	'lists',
	'link',
	'image',
	'media',
	'textcolor',
	'table',
	'code',
	'align',
	'fontfamily',
	'fontsize',
];

// Default toolbar configuration
const DEFAULT_TOOLBAR = "blocks fontfamily fontsize | bold forecolor backcolor removeformat | align numlist bullist | link image | table media | lineheight outdent indent | charmap emoticons | code fullscreen preview | pagebreak anchor codesample | ltr rtl | strikethrough";

const TinyMCERichTextEditor = forwardRef<TinyMCERichTextEditorRef, TinyMCERichTextEditorProps>(
	({ value, onChange, initialValue, placeholderSections, enablePlaceholders = false, plugins, toolbar, height = 400 }, ref) => {
		const apiKey = process.env.NEXT_PUBLIC_TINYMCE_API_KEY;
		const editorRef = React.useRef<any | null>(null);

		const mergetagsList = useMemo(() => {
			if (!enablePlaceholders) {
				return [];
			}
			return convertPlaceholdersToMergeTagsList(placeholderSections);
		}, [placeholderSections, enablePlaceholders]);

		useImperativeHandle(ref, () => ({
			getEditor: () => editorRef.current,
		}));

		React.useEffect(() => {
			const handleFocusIn = (e: FocusEvent) => {
				const target = e.target as HTMLElement;
				if (
					target &&
					(target.closest('.tox-tinymce-aux') ||
						target.closest('.tox-dialog') ||
						target.closest('.tox-menu') ||
						target.closest('.moxman-window') ||
						target.closest('.tam-assetmanager-root') ||
						target.closest('.mce-container'))
				) {
					e.stopImmediatePropagation();
				}
			};

			document.addEventListener('focusin', handleFocusIn, true);
			return () => {
				document.removeEventListener('focusin', handleFocusIn, true);
			};
		}, []);

		return (
			<Editor
				apiKey={apiKey || ''}
				value={value}
				onEditorChange={(content) => {
					if (onChange) {
						onChange(content);
					}
				}}
				onInit={(evt, editor) => {
					editorRef.current = editor;
				}}
				initialValue={initialValue}
				init={{
					height: height,
					menubar: false,
					plugins: [
						...(plugins || DEFAULT_PLUGINS),
						...(enablePlaceholders && mergetagsList.length > 0 ? ['mergetags'] : []),
					],
					toolbar: toolbar || DEFAULT_TOOLBAR,
					content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }',
					block_formats: 'Paragraph=p; Heading 1=h1; Heading 2=h2; Heading 3=h3; Heading 4=h4; Heading 5=h5; Heading 6=h6',
					font_family_formats: 'Andale Mono=andale mono,times; Arial=arial,helvetica,sans-serif; Arial Black=arial black,avant garde; Book Antiqua=book antiqua,palatino; Comic Sans MS=comic sans ms,sans-serif; Courier New=courier new,courier; Georgia=georgia,palatino; Helvetica=helvetica; Impact=impact,chicago; Symbol=symbol; Tahoma=tahoma,arial,helvetica,sans-serif; Terminal=terminal,monaco; Times New Roman=times new roman,times; Trebuchet MS=trebuchet ms,geneva; Verdana=verdana,geneva; Webdings=webdings; Wingdings=wingdings,zapf dingbats',
					fontsize_formats: '8pt 10pt 12pt 14pt 16pt 18pt 24pt 36pt 48pt',
					image_advtab: true,
					media_live_embeds: true,
					z_index: 2000,
					extended_valid_elements: 'span[class|style|data-placeholder]',
					valid_styles: {
						'*': 'color,font-size,font-family,background-color,font-weight,font-style,text-decoration,text-align,border,border-radius,padding,margin,display,vertical-align,white-space,line-height'
					},
					...(enablePlaceholders && mergetagsList.length > 0 && {
						mergetags_prefix: '[',
						mergetags_suffix: ']',
						mergetags_list: mergetagsList,
					}),
					setup: (editor: any) => {
						if (enablePlaceholders && mergetagsList.length > 0) {
							const formattingCommands = [
								'forecolor',
								'backcolor',
								'fontname',
								'fontsize',
								'bold',
								'italic',
								'underline',
								'strikethrough',
								'removeformat',
							];

							const isInMergeTag = (node: Node | null, body: Element): boolean => {
								if (!node) return false;
								
								if (node.nodeType === 1) {
									const el = node as Element;
									if (el.classList && el.classList.contains('mce-mergetag')) {
										return true;
									}
								}
								
								let parent = node.parentElement;
								while (parent && parent !== body) {
									if (parent.classList && parent.classList.contains('mce-mergetag')) {
										return true;
									}
									parent = parent.parentElement;
								}
								return false;
							};

							editor.on('BeforeExecCommand', (e: any) => {
								const command = e.command;
								
								if (!formattingCommands.includes(command)) {
									return;
								}

								const selection = editor.selection;
								const rng = selection.getRng();
								
								if (!rng || rng.collapsed) {
									return;
								}

								const body = editor.getBody();
								
								const selectedContent = selection.getContent({ format: 'html' });
								const tempDiv = editor.dom.create('div', {}, selectedContent);
								const mergeTags = tempDiv.querySelectorAll('.mce-mergetag');
								
								if (mergeTags.length === 0) {
									editor.dom.remove(tempDiv);
									return;
								}

								e.preventDefault();
							
								
								const textNodes: Node[] = [];
								
								const walker = document.createTreeWalker(
									body,
									NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
									{
										acceptNode: (node) => {
											if (rng.intersectsNode(node)) {
												if (isInMergeTag(node, body)) {
													return NodeFilter.FILTER_REJECT;
												}
												return NodeFilter.FILTER_ACCEPT;
											}
											return NodeFilter.FILTER_REJECT;
										}
									}
								);
								
								let node: Node | null;
								while ((node = walker.nextNode())) {
									if (node.nodeType === Node.TEXT_NODE || 
									    (node.nodeType === Node.ELEMENT_NODE && !isInMergeTag(node, body))) {
										textNodes.push(node);
									}
								}
								
								if (textNodes.length > 0) {
									const bookmark = selection.getBookmark(2, true);
									
									textNodes.forEach((node) => {
										try {
											const nodeRng = editor.dom.createRng();
											if (node.nodeType === Node.TEXT_NODE) {
												nodeRng.setStartBefore(node);
												nodeRng.setEndAfter(node);
											} else {
												nodeRng.selectNodeContents(node);
											}
											selection.setRng(nodeRng);
											editor.execCommand(command, false, e.value);
										} catch (err) {
										}
									});
									
									selection.moveToBookmark(bookmark);
								}
								
								editor.dom.remove(tempDiv);
							});

							editor.on('NodeChange', () => {
								const body = editor.getBody();
								const mergeTagSpans = body.querySelectorAll('span.mce-mergetag');
								
								mergeTagSpans.forEach((span: Element) => {
									// Ensure merge tags are non-editable
									if (span.getAttribute('contenteditable') !== 'false') {
										span.setAttribute('contenteditable', 'false');
									}
								});
							});
						}
					},
				}}
			/>
		);
	}
);

TinyMCERichTextEditor.displayName = 'TinyMCERichTextEditor';

export default TinyMCERichTextEditor;