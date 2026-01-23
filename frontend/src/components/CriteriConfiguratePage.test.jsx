import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CriteriConfiguratePage from './CriteriConfiguratePage';
import axios from 'axios';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';
import { isEqual } from '../utils/isEqual';

// Mock axios
vi.mock('axios');
vi.mock('../utils/isEqual', () => ({
    isEqual: vi.fn(),
}));

const mockLotConfig = {
    name: 'Lotto 1',
    reqs: [
        {
            id: 'req1',
            label: 'Requisito 1',
            type: 'reference',
            max_points: 10,
            criteria: [
                { id: 'c1', label: 'Criterio 1.1', weight: 1.5 },
                { id: 'c2', label: 'Criterio 1.2', weight: 2.5 },
            ],
        },
        {
            id: 'req2',
            label: 'Requisito 2',
            type: 'project',
            max_points: 20,
            criteria: [
                { id: 'c3', label: 'Criterio 2.1', weight: 1 },
            ],
        },
        {
            id: 'req3',
            label: 'Requisito 3',
            type: 'resource',
            max_points: 5,
        }
    ],
    state: {
        tech_inputs: {
            req1: {
                sub_req_vals: [
                    { sub_id: 'c1', val: 3 },
                    { sub_id: 'c2', val: 5 },
                ]
            }
        }
    }
};

const renderComponent = (props) => {
    return render(
        <I18nextProvider i18n={i18n}>
            <CriteriConfiguratePage
                lotKey="lotto1"
                lotConfig={mockLotConfig}
                onBack={vi.fn()}
                onSave={vi.fn()}
                {...props}
            />
        </I18nextProvider>
    );
};

describe('CriteriConfiguratePage', () => {
    beforeEach(() => {
        axios.post.mockResolvedValue({ data: {} });
        isEqual.mockReturnValue(false);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should not re-initialize if lotConfig is the same', () => {
        isEqual.mockReturnValue(true);
        const { rerender } = renderComponent();
        
        const newMockLotConfig = { ...mockLotConfig };

        rerender(
            <I18nextProvider i18n={i18n}>
                <CriteriConfiguratePage
                    lotKey="lotto1"
                    lotConfig={newMockLotConfig}
                    onBack={vi.fn()}
                    onSave={vi.fn()}
                />
            </I18nextProvider>
        );

        // We can't directly check if the useEffect logic ran, but we can check if isEqual was called
        expect(isEqual).toHaveBeenCalled();
    });

    it('should render the component with initial data', () => {
        renderComponent();

        expect(screen.getByText('Configurazione Criteri - lotto1')).toBeInTheDocument();
        expect(screen.getByText('Requisito 1')).toBeInTheDocument();
        expect(screen.getByText('Requisito 2')).toBeInTheDocument();
        expect(screen.queryByText('Requisito 3')).not.toBeInTheDocument(); // Not a reference or project
    });
    
    it('should expand a requirement section on click', () => {
        renderComponent();
        const req1Button = screen.getByText('Requisito 1');
        fireEvent.click(req1Button);

        expect(screen.getByPlaceholderText('Nome voce di valutazione')).toBeInTheDocument();
        expect(screen.getAllByPlaceholderText('Peso')).toHaveLength(2);
    });

    it('should add a new criterion', () => {
        renderComponent();
        const req1Button = screen.getByText('Requisito 1');
        fireEvent.click(req1Button);

        const addButton = screen.getByText('Aggiungi Criterio');
        fireEvent.click(addButton);

        expect(screen.getAllByPlaceholderText('Nome voce di valutazione')).toHaveLength(3);
    });

    it('should remove a criterion', () => {
        renderComponent();
        const req1Button = screen.getByText('Requisito 1');
        fireEvent.click(req1Button);

        const removeButtons = screen.getAllByRole('button', { name: /trash2/i });
        fireEvent.click(removeButtons[0]);

        expect(screen.getAllByPlaceholderText('Nome voce di valutazione')).toHaveLength(1);
    });

    it('should update a criterion label', () => {
        renderComponent();
        const req1Button = screen.getByText('Requisito 1');
        fireEvent.click(req1Button);

        const labelInput = screen.getAllByPlaceholderText('Nome voce di valutazione')[0];
        fireEvent.change(labelInput, { target: { value: 'New Label' } });

        expect(labelInput.value).toBe('New Label');
    });

    it('should update a criterion weight', () => {
        renderComponent();
        const req1Button = screen.getByText('Requisito 1');
        fireEvent.click(req1Button);

        const weightInput = screen.getAllByPlaceholderText('Peso')[0];
        fireEvent.change(weightInput, { target: { value: '3.5' } });

        expect(weightInput.value).toBe('3.5');
    });

    it('should show validation error for empty label', async () => {
        renderComponent();
        const req1Button = screen.getByText('Requisito 1');
        fireEvent.click(req1Button);

        const labelInput = screen.getAllByPlaceholderText('Nome voce di valutazione')[0];
        fireEvent.change(labelInput, { target: { value: '' } });

        const saveButton = screen.getByText('Salva Configurazione');
        fireEvent.click(saveButton);

        expect(await screen.findByText('Il nome non può essere vuoto.')).toBeInTheDocument();
    });

    it('should show validation error for zero weight', async () => {
        renderComponent();
        const req1Button = screen.getByText('Requisito 1');
        fireEvent.click(req1Button);

        const weightInput = screen.getAllByPlaceholderText('Peso')[0];
        fireEvent.change(weightInput, { target: { value: '0' } });

        const saveButton = screen.getByText('Salva Configurazione');
        fireEvent.click(saveButton);

        expect(await screen.findByText('Il peso deve essere un numero positivo.')).toBeInTheDocument();
    });

    it('should call onSave with updated config', async () => {
        const onSave = vi.fn();
        renderComponent({ onSave });

        const req1Button = screen.getByText('Requisito 1');
        fireEvent.click(req1Button);

        const labelInput = screen.getAllByPlaceholderText('Nome voce di valutazione')[0];
        fireEvent.change(labelInput, { target: { value: 'Updated Label' } });

        const saveButton = screen.getByText('Salva Configurazione');
        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalled();
            const payload = axios.post.mock.calls[0][1];
            expect(payload.lotto1.reqs[0].criteria[0].label).toBe('Updated Label');
            expect(onSave).toHaveBeenCalled();
        });
    });
});
