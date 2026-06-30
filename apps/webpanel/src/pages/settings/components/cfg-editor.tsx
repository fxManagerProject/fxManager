import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';
import { basicSetup } from 'codemirror';
import { useEffect, useRef } from 'react';
import { cfgLanguage } from './cfg-language';

interface CfgCodeEditorProps {
	docKey: string;
	value: string;
	editable?: boolean;
	onChange: (value: string) => void;
	onSave: () => void;
}

export function CfgCodeEditor({
	docKey,
	value,
	editable = true,
	onChange,
	onSave,
}: CfgCodeEditorProps) {
	const host = useRef<HTMLDivElement>(null);
	const view = useRef<EditorView | null>(null);
	const editableComp = useRef(new Compartment());

	const onChangeRef = useRef(onChange);
	const onSaveRef = useRef(onSave);
	onChangeRef.current = onChange;
	onSaveRef.current = onSave;

	useEffect(() => {
		if (!host.current) return;

		const state = EditorState.create({
			doc: value,
			extensions: [
				basicSetup,
				cfgLanguage(),
				oneDark,
				keymap.of([
					{
						key: 'Mod-s',
						preventDefault: true,
						run: () => {
							onSaveRef.current();
							return true;
						},
					},
				]),
				EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						onChangeRef.current(update.state.doc.toString());
					}
				}),
				editableComp.current.of(EditorView.editable.of(editable)),
				EditorView.theme({
					'&': { height: '100%' },
					'.cm-scroller': { overflow: 'auto', fontFamily: 'inherit' },
				}),
			],
		});

		const instance = new EditorView({ state, parent: host.current });
		view.current = instance;

		return () => {
			instance.destroy();
			view.current = null;
		};
	}, []);

	const lastKey = useRef(docKey);

	useEffect(() => {
		const instance = view.current;
		if (!instance || lastKey.current === docKey) return;
		lastKey.current = docKey;
		instance.dispatch({
			changes: { from: 0, to: instance.state.doc.length, insert: value },
		});
	}, [docKey, value]);

	useEffect(() => {
		const instance = view.current;
		if (!instance) return;
		instance.dispatch({
			effects: editableComp.current.reconfigure(
				EditorView.editable.of(editable),
			),
		});
	}, [editable]);

	return (
		<div
			ref={host}
			className="h-full w-full overflow-hidden font-mono text-sm"
		/>
	);
}
