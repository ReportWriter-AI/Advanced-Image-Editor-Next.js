import { toolColors } from './ImageEditorModal';

interface ColorDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  selectedColor: string;
  onColorSelect: (color: string) => void;
  className?: string;
  type?: 'arrow' | 'circle' | 'square';
}

export default function ColorDropdown({
  isOpen,
  onClose,
  selectedColor,
  onColorSelect,
  className = '',
  type = 'arrow'
}: ColorDropdownProps) {
  if (!isOpen) return null;

  const optionsClass = type === 'arrow' ? 'arrow-color-options' : type === 'circle' ? 'circle-color-options' : 'square-color-options';
  const optionClass = type === 'arrow' ? 'arrow-color-option' : type === 'circle' ? 'circle-color-option' : 'square-color-option';

  return (
    <div className={className}>
      <div className={optionsClass}>
        {toolColors.map(color => (
          <div
            key={color}
            className={`${optionClass} ${selectedColor === color ? 'selected' : ''}`}
            style={{ backgroundColor: color }}
            onClick={() => {
              onColorSelect(color);
              onClose();
            }}
            title={`Select ${color} for all tools`}
          />
        ))}
      </div>
    </div>
  );
}
